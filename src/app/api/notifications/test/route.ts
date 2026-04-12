import { NextRequest, NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import webpush from 'web-push';

// Configure VAPID keys for web push
try {
  if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY && process.env.VAPID_EMAIL) {
    webpush.setVapidDetails(
      `mailto:${process.env.VAPID_EMAIL}`,
      process.env.VAPID_PUBLIC_KEY,
      process.env.VAPID_PRIVATE_KEY
    );
  }
} catch (error) {
  console.error('VAPID configuration error:', error);
}

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
};

const toPushSubscription = (subscription: {
  endpoint: string;
  keys: Prisma.JsonValue;
  subscription: Prisma.JsonValue | null;
}): Record<string, unknown> | null => {
  if (isRecord(subscription.subscription)) {
    return subscription.subscription;
  }

  if (!subscription.endpoint) {
    return null;
  }

  return {
    endpoint: subscription.endpoint,
    keys: subscription.keys,
  };
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const rawUserEmail = typeof body.userEmail === 'string' ? body.userEmail : '';
    const userEmail = rawUserEmail.trim().toLowerCase();
    const { message } = body;

    if (!userEmail || !message) {
      return NextResponse.json(
        { error: 'Missing userEmail or message' },
        { status: 400 }
      );
    }

    const subscriptions = await prisma.pushSubscription.findMany({
      where: {
        userEmail,
      },
      select: {
        id: true,
        endpoint: true,
        keys: true,
        subscription: true,
      },
    });

    if (subscriptions.length === 0) {
      return NextResponse.json(
        { error: 'No active subscriptions found for this user' },
        { status: 404 }
      );
    }

    let successCount = 0;
    let failureCount = 0;
    const errors: string[] = [];

    // Send test notification to all user's devices
    for (const subscriptionRecord of subscriptions) {
      const pushSubscription = toPushSubscription(subscriptionRecord);
      const endpoint =
        pushSubscription && typeof pushSubscription.endpoint === 'string'
          ? pushSubscription.endpoint
          : '';

      if (!pushSubscription || !endpoint) {
        console.warn(`Skipping subscription ${subscriptionRecord.id} - missing endpoint`, subscriptionRecord);
        failureCount++;
        errors.push(`Subscription ${subscriptionRecord.id}: missing endpoint`);

        // Deactivate invalid subscription to avoid repeated failures
        try {
          await prisma.pushSubscription.update({
            where: { id: subscriptionRecord.id },
            data: {
              isActive: false,
              deactivatedAt: new Date(),
              deactivationReason: 'missing_endpoint',
            },
          });
          console.log(`Deactivated subscription ${subscriptionRecord.id} due to missing endpoint`);
        } catch (updateErr) {
          console.error(`Failed to deactivate invalid subscription ${subscriptionRecord.id}:`, updateErr);
        }

        continue;
      }

      try {
        await webpush.sendNotification(
          pushSubscription as any,
          JSON.stringify({
            title: message.title || 'Test Notification',
            body: message.body || 'This is a test notification from MindMate.',
            icon: message.icon || '/icon-192.png',
            badge: message.badge || '/icon-192.png',
            tag: 'test-notification',
            data: {
              type: 'test',
              timestamp: new Date().toISOString(),
              url: '/'
            }
          })
        );

        successCount++;
        await prisma.pushSubscription.update({
          where: { id: subscriptionRecord.id },
          data: { lastUsedAt: new Date() },
        });
      } catch (error) {
        const webPushError = error as { statusCode?: number; message?: string };
        console.error(`Failed to send test notification to subscription ${subscriptionRecord.id}:`, error);
        failureCount++;

        // If subscription is invalid (410 or 404), remove it
        if (webPushError.statusCode === 410 || webPushError.statusCode === 404) {
          try {
            await prisma.pushSubscription.delete({
              where: { id: subscriptionRecord.id },
            });
            console.log(`Removed invalid subscription: ${subscriptionRecord.id}`);
          } catch (deleteError) {
            console.error(`Failed to delete invalid subscription ${subscriptionRecord.id}:`, deleteError);
          }
        }

        errors.push(`Subscription ${subscriptionRecord.id}: ${webPushError.message || 'Unknown error'}`);
      }
    }

    return NextResponse.json({
      success: true,
      message: `Test notification sent successfully`,
      stats: {
        successCount,
        failureCount,
        totalSubscriptions: subscriptions.length
      },
      errors: failureCount > 0 ? errors : undefined
    });

  } catch (error: any) {
    console.error('Error sending test notification:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
