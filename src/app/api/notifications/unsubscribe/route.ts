import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedUserEmail } from '@/lib/auth-utils';

export async function POST(request: NextRequest) {
  try {
    const authenticatedUserEmail = await getAuthenticatedUserEmail(request);
    if (!authenticatedUserEmail) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const rawUserEmail = typeof body.userEmail === 'string' ? body.userEmail : '';
    const requestedUserEmail = rawUserEmail.trim().toLowerCase();
    const userEmail = requestedUserEmail || authenticatedUserEmail;
    const subscriptionId = typeof body.subscriptionId === 'string' ? body.subscriptionId : undefined;
    const endpoint = typeof body.endpoint === 'string' ? body.endpoint : undefined;

    if (requestedUserEmail && requestedUserEmail !== authenticatedUserEmail) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }

    if (subscriptionId) {
      // Unsubscribe specific subscription
      await prisma.pushSubscription.updateMany({
        where: {
          id: subscriptionId,
          userEmail,
        },
        data: {
          isActive: false,
          unsubscribedAt: new Date(),
        },
      });

      console.log(`Push subscription ${subscriptionId} unsubscribed for user ${userEmail}`);
    } else if (endpoint) {
      await prisma.pushSubscription.updateMany({
        where: {
          endpoint,
          userEmail,
          isActive: true,
        },
        data: {
          isActive: false,
          unsubscribedAt: new Date(),
        },
      });

      console.log(`Push subscription endpoint unsubscribed for user ${userEmail}`);
    } else {
      // Unsubscribe all subscriptions for the user
      await prisma.pushSubscription.updateMany({
        where: {
          userEmail,
          isActive: true,
        },
        data: {
          isActive: false,
          unsubscribedAt: new Date(),
        },
      });

      console.log(`All push subscriptions unsubscribed for user ${userEmail}`);
    }

    return NextResponse.json({
      success: true,
      message: 'Push subscription(s) unsubscribed successfully'
    });

  } catch (error) {
    console.error('Error in unsubscribe:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
