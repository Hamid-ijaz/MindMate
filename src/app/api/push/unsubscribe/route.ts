import { NextRequest, NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedUserEmail, isAuthorizedCronRequest } from '@/lib/auth-utils';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as { userId?: string; endpoint?: string };
    const { userId, endpoint } = body;
    const authenticatedUserEmail = await getAuthenticatedUserEmail(request);
    const isCronRequest = isAuthorizedCronRequest(request);

    if (!isCronRequest && !authenticatedUserEmail) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const targetUserId = userId || authenticatedUserEmail;

    if (!isCronRequest && userId && authenticatedUserEmail !== userId) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }
    
    let where: Prisma.PushSubscriptionWhereInput;

    if (endpoint) {
      where = { endpoint };
    } else if (targetUserId) {
      where = {
        userEmail: targetUserId,
        isActive: true,
      };
    } else {
      return NextResponse.json(
        { error: 'Either userId or endpoint is required' },
        { status: 400 }
      );
    }

    const result = await prisma.pushSubscription.updateMany({
      where,
      data: {
        isActive: false,
        unsubscribedAt: new Date(),
      },
    });

    if (result.count === 0) {
      return NextResponse.json(
        { message: 'No subscriptions found to remove' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Successfully removed ${result.count} subscription(s)`,
      count: result.count,
    });
  } catch (error) {
    console.error('Error removing push subscription:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to remove subscription',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
