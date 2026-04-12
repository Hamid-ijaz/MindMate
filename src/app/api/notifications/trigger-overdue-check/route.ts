import { NextRequest, NextResponse } from 'next/server';
import webpush from 'web-push';
import { prisma } from '@/lib/prisma';
import type { PushSubscription } from '@prisma/client';

type JsonObject = Record<string, unknown>;

const isJsonObject = (value: unknown): value is JsonObject => {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
};

const getCanonicalSubscription = (
  pushSubscription: PushSubscription
): { endpoint: string; keys: { p256dh: string; auth: string } } | null => {
  const subscription = pushSubscription.subscription;
  if (isJsonObject(subscription)) {
    const keys = subscription.keys;
    if (
      typeof subscription.endpoint === 'string' &&
      isJsonObject(keys) &&
      typeof keys.p256dh === 'string' &&
      typeof keys.auth === 'string'
    ) {
      return {
        endpoint: subscription.endpoint,
        keys: {
          p256dh: keys.p256dh,
          auth: keys.auth,
        },
      };
    }
  }

  const keys = pushSubscription.keys;
  if (
    typeof pushSubscription.endpoint === 'string' &&
    isJsonObject(keys) &&
    typeof keys.p256dh === 'string' &&
    typeof keys.auth === 'string'
  ) {
    return {
      endpoint: pushSubscription.endpoint,
      keys: {
        p256dh: keys.p256dh,
        auth: keys.auth,
      },
    };
  }

  return null;
};

const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || process.env.VAPID_PUBLIC_KEY;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
const vapidEmail = process.env.VAPID_EMAIL || 'hamid.ijaz91@gmail.com';

if (vapidPublicKey && vapidPrivateKey) {
  try {
    webpush.setVapidDetails(`mailto:${vapidEmail}`, vapidPublicKey, vapidPrivateKey);
  } catch (error) {
    console.error('VAPID configuration error:', error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const now = new Date();

    const overdueTasks = await prisma.task.findMany({
      where: {
        completedAt: null,
        reminderAt: { lte: now },
        isMuted: false,
      },
      select: {
        id: true,
        userEmail: true,
      },
    });

    const overdueTasksCount = overdueTasks.length;
    const processedUsers = new Set<string>();

    for (const task of overdueTasks) {
      const userEmail = task.userEmail;
      if (!userEmail || processedUsers.has(userEmail)) {
        continue;
      }
      processedUsers.add(userEmail);

      try {
        const subscriptions = await prisma.pushSubscription.findMany({
          where: {
            userEmail,
            isActive: true,
          },
          orderBy: { createdAt: 'asc' },
        });

        if (subscriptions.length === 0) {
          continue;
        }

        const userOverdueCount = await prisma.task.count({
          where: {
            userEmail,
            completedAt: null,
            reminderAt: { lte: now },
            isMuted: false,
          },
        });

        const payload = {
          title: 'Overdue Tasks',
          body: `You have ${userOverdueCount} overdue task${userOverdueCount !== 1 ? 's' : ''}`,
          icon: '/icon-192.png',
          badge: '/icon-192.png',
          tag: 'overdue-tasks',
          data: {
            type: 'overdue',
            count: userOverdueCount,
            url: '/tasks',
          },
        };

        await Promise.all(
          subscriptions.map(async (subscriptionRow) => {
            const canonical = getCanonicalSubscription(subscriptionRow);
            if (!canonical) {
              await prisma.pushSubscription.update({
                where: { id: subscriptionRow.id },
                data: {
                  isActive: false,
                  deactivatedAt: new Date(),
                  deactivationReason: 'invalid_subscription_payload',
                },
              });
              return;
            }

            try {
              await webpush.sendNotification(canonical, JSON.stringify(payload));
              await prisma.pushSubscription.update({
                where: { id: subscriptionRow.id },
                data: { lastUsedAt: new Date() },
              });
            } catch (error: unknown) {
              const webPushError = error as { statusCode?: number };
              if (webPushError.statusCode === 410 || webPushError.statusCode === 404) {
                await prisma.pushSubscription.update({
                  where: { id: subscriptionRow.id },
                  data: {
                    isActive: false,
                    deactivatedAt: new Date(),
                    deactivationReason: `webpush_${webPushError.statusCode}`,
                  },
                });
              }
            }
          })
        );

        await prisma.task.updateMany({
          where: {
            userEmail,
            completedAt: null,
            reminderAt: { lte: now },
            isMuted: false,
          },
          data: { notifiedAt: now },
        });
      } catch (error) {
        console.error(`Error processing notifications for user ${userEmail}:`, error);
      }
    }

    return NextResponse.json({
      success: true,
      message: `Processed ${overdueTasksCount} overdue tasks for ${processedUsers.size} users`,
      overdueTasksCount,
      usersNotified: processedUsers.size,
    });
  } catch (error) {
    console.error('Error in trigger-overdue-check:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  return POST(request);
}

