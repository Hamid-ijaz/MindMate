import { NextRequest, NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import { getAuthenticatedUserEmail } from '@/lib/auth-utils';
import { prisma } from '@/lib/prisma';
import type { ShareAnalytics, ShareHistoryEntry } from '@/lib/types';

type RouteContext = {
  params: Promise<{ token: string }>;
};

type ShareWithHistory = Prisma.SharedItemGetPayload<{
  include: {
    history: {
      include: {
        user: {
          select: {
            email: true;
            firstName: true;
            lastName: true;
          };
        };
      };
    };
  };
}>;

const getTokenFromParams = async (context: RouteContext): Promise<string> => {
  const { token } = await context.params;
  return token;
};

const toDisplayName = (
  firstName?: string | null,
  lastName?: string | null,
  email?: string | null
): string => {
  const fullName = `${firstName ?? ''} ${lastName ?? ''}`.trim();
  if (fullName) {
    return fullName;
  }

  if (email) {
    return email.split('@')[0] || email;
  }

  return 'Anonymous User';
};

const mapHistoryEntry = (
  entry: ShareWithHistory['history'][number]
): ShareHistoryEntry => {
  const userEmail = entry.userEmail ?? entry.user?.email ?? undefined;

  return {
    id: entry.id,
    userId: userEmail,
    userName: toDisplayName(entry.user?.firstName, entry.user?.lastName, userEmail),
    action: entry.action,
    timestamp: entry.timestamp.getTime(),
    details: entry.details ?? undefined,
  };
};

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const authenticatedEmail = await getAuthenticatedUserEmail(_request);
    if (!authenticatedEmail) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const token = await getTokenFromParams(context);

    const sharedItem = await prisma.sharedItem.findFirst({
      where: {
        shareToken: token,
        isActive: true,
        ownerEmail: authenticatedEmail,
      },
      include: {
        history: {
          orderBy: {
            timestamp: 'asc',
          },
          include: {
            user: {
              select: {
                email: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
    });

    if (!sharedItem) {
      return NextResponse.json({ error: 'Share not found' }, { status: 404 });
    }

    const recentActivity = sharedItem.history.map(mapHistoryEntry);
    const uniqueViewers = new Set(
      sharedItem.history
        .filter((entry) => entry.action === 'viewed')
        .map((entry) => entry.userEmail ?? 'anonymous')
    ).size;

    const uniqueEditors = new Set(
      sharedItem.history
        .filter((entry) => entry.action.includes('edit'))
        .map((entry) => entry.userEmail ?? 'anonymous')
    ).size;

    const actionCounts = sharedItem.history.reduce<Record<string, number>>((acc, entry) => {
      const currentCount = acc[entry.action] ?? 0;
      acc[entry.action] = currentCount + 1;
      return acc;
    }, {});

    const topActions = Object.entries(actionCounts)
      .map(([action, count]) => ({ action, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    const analytics: ShareAnalytics = {
      totalViews: sharedItem.viewCount,
      uniqueViewers,
      totalEdits: sharedItem.history.filter((entry) => entry.action.includes('edit')).length,
      uniqueEditors,
      topActions,
      recentActivity: recentActivity.slice(-10).reverse(),
    };

    return NextResponse.json(analytics);
  } catch (error) {
    console.error('Error loading share analytics:', error);
    return NextResponse.json(
      { error: 'Failed to load analytics' },
      { status: 500 }
    );
  }
}
