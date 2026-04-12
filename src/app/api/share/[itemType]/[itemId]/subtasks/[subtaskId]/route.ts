import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUserEmail } from '@/lib/auth-utils';
import { sharePrismaService } from '@/services/server/share-prisma-service';

type RouteContext = {
  params: Promise<{ itemType: string; itemId: string; subtaskId: string }>;
};

type PatchSubtaskBody = {
  token?: string;
  updates?: Record<string, unknown>;
  clearFields?: string[];
};

type DeleteSubtaskBody = {
  token?: string;
};

const isValidItemType = (value: string): value is 'task' | 'note' => {
  return value === 'task' || value === 'note';
};

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null;
};

const getRouteParams = async (
  context: RouteContext
): Promise<{ itemType: 'task' | 'note'; itemId: string; subtaskId: string } | null> => {
  const { itemType, itemId, subtaskId } = await context.params;

  if (!isValidItemType(itemType) || !itemId || !subtaskId) {
    return null;
  }

  return {
    itemType,
    itemId,
    subtaskId,
  };
};

const applyClearFields = (
  updates: Record<string, unknown>,
  clearFields?: string[]
): Record<string, unknown> => {
  const mergedUpdates = { ...updates };

  if (!Array.isArray(clearFields)) {
    return mergedUpdates;
  }

  for (const field of clearFields) {
    if (typeof field === 'string' && !(field in mergedUpdates)) {
      mergedUpdates[field] = null;
    }
  }

  return mergedUpdates;
};

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const params = await getRouteParams(context);
    if (!params) {
      return NextResponse.json({ error: 'Invalid route parameters' }, { status: 400 });
    }

    if (params.itemType !== 'task') {
      return NextResponse.json({ error: 'Subtasks are only supported for tasks' }, { status: 400 });
    }

    const body = (await request.json()) as PatchSubtaskBody | Record<string, unknown>;
    const token = typeof (body as PatchSubtaskBody).token === 'string' ? (body as PatchSubtaskBody).token : null;
    const userEmail = await getAuthenticatedUserEmail(request);

    if (!token) {
      return NextResponse.json({ error: 'Share token is required' }, { status: 400 });
    }

    if (!userEmail) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const updatesFromBody = isRecord((body as PatchSubtaskBody).updates)
      ? (body as PatchSubtaskBody).updates
      : null;

    if (!updatesFromBody) {
      return NextResponse.json({ error: 'Subtask updates are required' }, { status: 400 });
    }

    const clearFields = Array.isArray((body as PatchSubtaskBody).clearFields)
      ? (body as PatchSubtaskBody).clearFields
      : undefined;

    const updates = applyClearFields(updatesFromBody, clearFields);

    const result = await sharePrismaService.updateSubtask(
      token,
      params.itemType,
      params.itemId,
      params.subtaskId,
      updates,
      userEmail
    );

    if (!result.validation.isValid) {
      return NextResponse.json(result.validation, { status: 403 });
    }

    if (!result.subtask) {
      return NextResponse.json({ error: 'Subtask not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      subtask: result.subtask,
      sharedItem: result.validation.sharedItem,
    });
  } catch (error) {
    console.error('Error updating shared subtask:', error);
    return NextResponse.json({ error: 'Failed to update shared subtask' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const params = await getRouteParams(context);
    if (!params) {
      return NextResponse.json({ error: 'Invalid route parameters' }, { status: 400 });
    }

    if (params.itemType !== 'task') {
      return NextResponse.json({ error: 'Subtasks are only supported for tasks' }, { status: 400 });
    }

    const body = (await request.json().catch(() => ({}))) as DeleteSubtaskBody;
    const token = typeof body.token === 'string' ? body.token : null;
    const userEmail = await getAuthenticatedUserEmail(request);

    if (!token) {
      return NextResponse.json({ error: 'Share token is required' }, { status: 400 });
    }

    if (!userEmail) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const result = await sharePrismaService.deleteSubtask(
      token,
      params.itemType,
      params.itemId,
      params.subtaskId,
      userEmail
    );

    if (!result.validation.isValid) {
      return NextResponse.json(result.validation, { status: 403 });
    }

    if (!result.deleted) {
      return NextResponse.json({ error: 'Subtask not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, deleted: true });
  } catch (error) {
    console.error('Error deleting shared subtask:', error);
    return NextResponse.json({ error: 'Failed to delete shared subtask' }, { status: 500 });
  }
}
