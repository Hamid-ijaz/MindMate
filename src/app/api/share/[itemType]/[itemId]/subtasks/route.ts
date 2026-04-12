import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUserEmail } from '@/lib/auth-utils';
import { sharePrismaService } from '@/services/server/share-prisma-service';

type RouteContext = {
  params: Promise<{ itemType: string; itemId: string }>;
};

type AddSubtaskBody = {
  token?: string;
  subtask?: Record<string, unknown>;
};

const isValidItemType = (value: string): value is 'task' | 'note' => {
  return value === 'task' || value === 'note';
};

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null;
};

const getRouteParams = async (
  context: RouteContext
): Promise<{ itemType: 'task' | 'note'; itemId: string } | null> => {
  const { itemType, itemId } = await context.params;

  if (!isValidItemType(itemType) || !itemId) {
    return null;
  }

  return {
    itemType,
    itemId,
  };
};

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const params = await getRouteParams(context);
    if (!params) {
      return NextResponse.json({ error: 'Invalid route parameters' }, { status: 400 });
    }

    if (params.itemType !== 'task') {
      return NextResponse.json({ error: 'Subtasks are only supported for tasks' }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');
    const userEmail = (await getAuthenticatedUserEmail(request)) ?? undefined;

    if (!token) {
      return NextResponse.json({ error: 'Share token is required' }, { status: 400 });
    }

    const result = await sharePrismaService.listSubtasks(
      token,
      params.itemType,
      params.itemId,
      userEmail
    );

    if (!result.validation.isValid) {
      return NextResponse.json(result.validation, { status: 403 });
    }

    return NextResponse.json({
      subtasks: result.subtasks,
      sharedItem: result.validation.sharedItem,
    });
  } catch (error) {
    console.error('Error loading shared subtasks:', error);
    return NextResponse.json({ error: 'Failed to load shared subtasks' }, { status: 500 });
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const params = await getRouteParams(context);
    if (!params) {
      return NextResponse.json({ error: 'Invalid route parameters' }, { status: 400 });
    }

    if (params.itemType !== 'task') {
      return NextResponse.json({ error: 'Subtasks are only supported for tasks' }, { status: 400 });
    }

    const body = (await request.json()) as AddSubtaskBody;
    const token = typeof body.token === 'string' ? body.token : null;
    const userEmail = await getAuthenticatedUserEmail(request);

    if (!token) {
      return NextResponse.json({ error: 'Share token is required' }, { status: 400 });
    }

    if (!userEmail) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    if (!isRecord(body.subtask)) {
      return NextResponse.json({ error: 'Subtask data is required' }, { status: 400 });
    }

    const result = await sharePrismaService.addSubtask(
      token,
      params.itemType,
      params.itemId,
      body.subtask,
      userEmail
    );

    if (!result.validation.isValid) {
      return NextResponse.json(result.validation, { status: 403 });
    }

    if (!result.subtask) {
      return NextResponse.json({ error: 'Failed to create subtask' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      subtask: result.subtask,
      sharedItem: result.validation.sharedItem,
    });
  } catch (error) {
    console.error('Error adding shared subtask:', error);
    return NextResponse.json({ error: 'Failed to add shared subtask' }, { status: 500 });
  }
}
