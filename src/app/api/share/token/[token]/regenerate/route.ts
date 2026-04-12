import { randomBytes } from 'node:crypto';
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

const generateShareToken = (): string => {
  return `${randomBytes(12).toString('hex')}${Date.now().toString(36)}`;
};

const createUniqueShareToken = async (): Promise<string> => {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const candidate = generateShareToken();
    const existing = await prisma.sharedItem.findUnique({
      where: { shareToken: candidate },
      select: { id: true },
    });

    if (!existing) {
      return candidate;
    }
  }

  throw new Error('Failed to generate a unique share token');
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
      return NextResponse.json({ error: 'Share not found' }, { status: 404 });
    }

    const newToken = await createUniqueShareToken();

    await prisma.$transaction([
      prisma.sharedItem.update({
        where: { id: share.id },
        data: {
          shareToken: newToken,
          updatedAt: new Date(),
        },
      }),
      prisma.shareHistoryEntry.create({
        data: {
          sharedItemId: share.id,
          userEmail: share.ownerEmail,
          action: 'link_regenerated',
          details: 'Share link was regenerated for security',
        },
      }),
    ]);

    return NextResponse.json({ shareToken: newToken });
  } catch (error) {
    console.error('Error regenerating share token:', error);
    return NextResponse.json(
      { error: 'Failed to regenerate share link' },
      { status: 500 }
    );
  }
}
