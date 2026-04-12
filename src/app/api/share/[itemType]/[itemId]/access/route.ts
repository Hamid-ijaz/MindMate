import { NextRequest, NextResponse } from 'next/server';
import type { SharePermission } from '@/lib/types';
import { getAuthenticatedUserEmail } from '@/lib/auth-utils';
import { sharePrismaService } from '@/services/server/share-prisma-service';

type RouteContext = {
  params: Promise<{ itemType: string; itemId: string }>;
};

type AccessBody = {
  token?: string;
  userName?: string;
  requiredPermission?: SharePermission;
  recordView?: boolean;
};

const isValidItemType = (value: string): value is 'task' | 'note' => {
  return value === 'task' || value === 'note';
};

const isValidPermission = (value: unknown): value is SharePermission => {
  return value === 'view' || value === 'edit';
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

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const params = await getRouteParams(context);
    if (!params) {
      return NextResponse.json({ error: 'Invalid route parameters' }, { status: 400 });
    }

    const body = (await request.json()) as AccessBody;
    const token = typeof body.token === 'string' ? body.token : null;

    if (!token) {
      return NextResponse.json({ error: 'Share token is required' }, { status: 400 });
    }

    const requiredPermission = isValidPermission(body.requiredPermission)
      ? body.requiredPermission
      : 'view';

    const authenticatedEmail = await getAuthenticatedUserEmail(request);
    const resolvedUserEmail = authenticatedEmail ?? undefined;

    if (requiredPermission === 'edit' && !resolvedUserEmail) {
      return NextResponse.json({ isValid: false, error: 'Authentication required for editing' });
    }

    const validation = await sharePrismaService.validateShareAccess(
      token,
      params.itemType,
      params.itemId,
      requiredPermission,
      resolvedUserEmail
    );

    if (!validation.isValid) {
      return NextResponse.json(validation);
    }

    if (body.recordView) {
      const updatedSharedItem = await sharePrismaService.recordView(
        token,
        params.itemType,
        params.itemId,
        resolvedUserEmail,
        body.userName
      );

      return NextResponse.json({
        ...validation,
        sharedItem: updatedSharedItem ?? validation.sharedItem,
      });
    }

    return NextResponse.json(validation);
  } catch (error) {
    console.error('Error validating shared access:', error);
    return NextResponse.json({ error: 'Failed to validate shared access' }, { status: 500 });
  }
}
