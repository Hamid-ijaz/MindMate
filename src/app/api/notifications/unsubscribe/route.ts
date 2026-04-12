import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const rawUserEmail = typeof body.userEmail === 'string' ? body.userEmail : '';
    const userEmail = rawUserEmail.trim().toLowerCase();
    const subscriptionId = typeof body.subscriptionId === 'string' ? body.subscriptionId : undefined;
    const endpoint = typeof body.endpoint === 'string' ? body.endpoint : undefined;

    if (!userEmail) {
      return NextResponse.json(
        { error: 'Missing required field: userEmail' },
        { status: 400 }
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
