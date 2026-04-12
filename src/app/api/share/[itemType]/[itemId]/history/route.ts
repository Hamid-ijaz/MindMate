import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUserEmail } from '@/lib/auth-utils';
import { sharePrismaService } from '@/services/server/share-prisma-service';

type RouteContext = {
  params: Promise<{ itemType: string; itemId: string }>;
};

type HistoryEntryBody = {
  userId?: string;
  userName?: string;
  action?: string;
  details?: string;
};

type HistoryBody = {
  token?: string;
  updateItemTimestamp?: boolean;
  entry?: HistoryEntryBody;
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

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const params = await getRouteParams(context);
    if (!params) {
      return NextResponse.json({ error: 'Invalid route parameters' }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');
    const userEmail = (await getAuthenticatedUserEmail(request)) ?? undefined;
    const limit = Number(searchParams.get('limit') ?? '100');

    if (!token) {
      return NextResponse.json({ error: 'Share token is required' }, { status: 400 });
    }

    const validation = await sharePrismaService.validateShareAccess(
      token,
      params.itemType,
      params.itemId,
      'view',
      userEmail
    );

    if (!validation.isValid) {
      return NextResponse.json(validation, { status: 403 });
    }

    const history = await sharePrismaService.getHistory(
      token,
      params.itemType,
      params.itemId,
      Number.isFinite(limit) ? limit : 100
    );

    return NextResponse.json({
      history,
      sharedItem: validation.sharedItem,
    });
  } catch (error) {
    console.error('Error loading share history:', error);
    return NextResponse.json({ error: 'Failed to load share history' }, { status: 500 });
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const params = await getRouteParams(context);
    if (!params) {
      return NextResponse.json({ error: 'Invalid route parameters' }, { status: 400 });
    }

    const body = (await request.json()) as HistoryBody;
    const token = typeof body.token === 'string' ? body.token : null;
    const userEmail = await getAuthenticatedUserEmail(request);

    if (!token) {
      return NextResponse.json({ error: 'Share token is required' }, { status: 400 });
    }

    if (!userEmail) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const entry = body.entry;
    if (!entry || typeof entry.action !== 'string') {
      return NextResponse.json({ error: 'History entry action is required' }, { status: 400 });
    }

    const validation = await sharePrismaService.validateShareAccess(
      token,
      params.itemType,
      params.itemId,
      'view',
      userEmail
    );

    if (!validation.isValid) {
      return NextResponse.json(validation, { status: 403 });
    }

    await sharePrismaService.addHistoryEntry(
      token,
      params.itemType,
      params.itemId,
      {
        userId: userEmail,
        userName: entry.userName,
        action: entry.action,
        details: entry.details,
      },
      body.updateItemTimestamp ?? true
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error adding share history entry:', error);
    return NextResponse.json({ error: 'Failed to add share history entry' }, { status: 500 });
  }
}
