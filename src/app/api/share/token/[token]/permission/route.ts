import { NextRequest, NextResponse } from 'next/server';
import type { SharePermission } from '@/lib/types';
import { getAuthenticatedUserEmail } from '@/lib/auth-utils';
import { prisma } from '@/lib/prisma';

type RouteContext = {
  params: Promise<{ token: string }>;
};

type UpdatePermissionBody = {
  permission?: SharePermission;
};

const isSharePermission = (value: unknown): value is SharePermission => {
  return value === 'view' || value === 'edit';
};

const getTokenFromParams = async (context: RouteContext): Promise<string> => {
  const { token } = await context.params;
  return token;
};

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const authenticatedEmail = await getAuthenticatedUserEmail(request);
    if (!authenticatedEmail) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const token = await getTokenFromParams(context);
    const body = (await request.json()) as UpdatePermissionBody;
    const { permission } = body;

    if (!isSharePermission(permission)) {
      return NextResponse.json(
        { error: 'permission must be view or edit' },
        { status: 400 }
      );
    }

    const share = await prisma.sharedItem.findFirst({
      where: {
        shareToken: token,
        ownerEmail: authenticatedEmail,
      },
      select: {
        id: true,
        ownerEmail: true,
        ownerName: true,
        permission: true,
      },
    });

    if (!share) {
      return NextResponse.json({ success: true });
    }

    await prisma.$transaction([
      prisma.sharedItem.update({
        where: { id: share.id },
        data: {
          permission,
          updatedAt: new Date(),
        },
      }),
      prisma.shareHistoryEntry.create({
        data: {
          sharedItemId: share.id,
          userEmail: share.ownerEmail,
          action: 'permission_changed',
          details: `Permission changed from ${share.permission} to ${permission}`,
        },
      }),
    ]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating share permission:', error);
    return NextResponse.json(
      { error: 'Failed to update permission' },
      { status: 500 }
    );
  }
}
