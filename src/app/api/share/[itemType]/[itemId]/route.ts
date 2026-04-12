import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUserEmail } from '@/lib/auth-utils';
import { sharePrismaService } from '@/services/server/share-prisma-service';

type RouteContext = {
  params: Promise<{ itemType: string; itemId: string }>;
};

type PatchBody = {
  token?: string;
  updates?: Record<string, unknown>;
  clearFields?: string[];
};

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null;
};

const isValidItemType = (value: string): value is 'task' | 'note' => {
  return value === 'task' || value === 'note';
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

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const params = await getRouteParams(context);
    if (!params) {
      return NextResponse.json({ error: 'Invalid route parameters' }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');
    const userEmail = (await getAuthenticatedUserEmail(request)) ?? undefined;

    if (!token) {
      return NextResponse.json({ error: 'Share token is required' }, { status: 400 });
    }

    const result = await sharePrismaService.getSharedContent(
      token,
      params.itemType,
      params.itemId,
      userEmail
    );

    if (!result.validation.isValid) {
      return NextResponse.json(result.validation, { status: 403 });
    }

    if (!result.payload?.content) {
      return NextResponse.json({ error: 'Content not found' }, { status: 404 });
    }

    return NextResponse.json({
      sharedItem: result.validation.sharedItem,
      content: result.payload.content,
      subtasks: result.payload.subtasks,
    });
  } catch (error) {
    console.error('Error loading shared content:', error);
    return NextResponse.json({ error: 'Failed to load shared content' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const params = await getRouteParams(context);
    if (!params) {
      return NextResponse.json({ error: 'Invalid route parameters' }, { status: 400 });
    }

    const body = (await request.json()) as PatchBody | Record<string, unknown>;

    const token = typeof (body as PatchBody).token === 'string' ? (body as PatchBody).token : null;
    const userEmail = await getAuthenticatedUserEmail(request);

    if (!token) {
      return NextResponse.json({ error: 'Share token is required' }, { status: 400 });
    }

    if (!userEmail) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const updatesFromBody = isRecord((body as PatchBody).updates)
      ? (body as PatchBody).updates
      : null;

    if (!updatesFromBody) {
      return NextResponse.json({ error: 'Content updates are required' }, { status: 400 });
    }

    const clearFields = Array.isArray((body as PatchBody).clearFields)
      ? (body as PatchBody).clearFields
      : undefined;

    const updates = applyClearFields(updatesFromBody, clearFields);

    const result = await sharePrismaService.updateSharedContent(
      token,
      params.itemType,
      params.itemId,
      updates,
      userEmail
    );

    if (!result.validation.isValid) {
      return NextResponse.json(result.validation, { status: 403 });
    }

    if (!result.content) {
      return NextResponse.json({ error: 'Content not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      content: result.content,
      sharedItem: result.validation.sharedItem,
    });
  } catch (error) {
    console.error('Error updating shared content:', error);
    return NextResponse.json({ error: 'Failed to update shared content' }, { status: 500 });
  }
}
