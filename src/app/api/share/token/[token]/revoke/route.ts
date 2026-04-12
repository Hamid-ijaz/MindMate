import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUserEmail } from '@/lib/auth-utils';
import { prisma } from '@/lib/prisma';

type RouteContext = {
  params: Promise<{ token: string }>;
};

const getTokenFromParams = async (context: RouteContext): Promise<string> => {
  const { token } = await context.params;
  return token;
};

export async function POST(_request: NextRequest, context: RouteContext) {
  try {
    const authenticatedEmail = await getAuthenticatedUserEmail(_request);
    if (!authenticatedEmail) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const token = await getTokenFromParams(context);

    const share = await prisma.sharedItem.findFirst({
      where: {
        shareToken: token,
        ownerEmail: authenticatedEmail,
      },
      select: {
        id: true,
        ownerEmail: true,
      },
    });

    if (!share) {
      return NextResponse.json({ success: true });
    }

    await prisma.$transaction([
      prisma.sharedItem.update({
        where: { id: share.id },
        data: {
          isActive: false,
          updatedAt: new Date(),
        },
      }),
      prisma.shareHistoryEntry.create({
        data: {
          sharedItemId: share.id,
          userEmail: share.ownerEmail,
          action: 'access_revoked',
          details: 'Share access has been revoked',
        },
      }),
    ]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error revoking share access:', error);
    return NextResponse.json(
      { error: 'Failed to revoke share access' },
      { status: 500 }
    );
  }
}
