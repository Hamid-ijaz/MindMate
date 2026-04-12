import { NextRequest, NextResponse } from 'next/server';
import webpush from 'web-push';
import { getAuthenticatedUserEmail, isAuthorizedCronRequest } from '@/lib/auth-utils';
import { prisma } from '@/lib/prisma';
import type { Prisma, PushSubscription } from '@prisma/client';

type SendTaskReminderBody = {
  taskId?: string;
  userEmail?: string;
  title?: string;
  message?: string;
};

type JsonObject = Record<string, unknown>;

const isJsonObject = (value: unknown): value is JsonObject => {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
};

const sanitizeJsonValue = (value: unknown): unknown => {
  if (value === undefined) {
    return null;
  }

  if (Array.isArray(value)) {
    return value.map((entry) => sanitizeJsonValue(entry));
  }

  if (isJsonObject(value)) {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, nested]) => nested !== undefined)
        .map(([key, nested]) => [key, sanitizeJsonValue(nested)])
    );
  }

  return value;
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
    const body = (await request.json()) as SendTaskReminderBody;
    const { taskId, userEmail, title, message } = body;
    const authenticatedUserEmail = await getAuthenticatedUserEmail(request);
    const isCronRequest = isAuthorizedCronRequest(request);

    if (!isCronRequest && !authenticatedUserEmail) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    if (!taskId || !userEmail || !title || !message) {
      return NextResponse.json(
        { error: 'Missing required fields: taskId, userEmail, title, message' },
        { status: 400 }
      );
    }

    if (!isCronRequest && authenticatedUserEmail !== userEmail) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const subscriptions = await prisma.pushSubscription.findMany({
      where: {
        userEmail,
        isActive: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    if (subscriptions.length === 0) {
      return NextResponse.json(
        { error: 'No push subscriptions found for user' },
        { status: 404 }
      );
    }

    const notificationId = `notif_${userEmail.replace('@', '_').replace(/\./g, '_')}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    await prisma.notification.create({
      data: {
        id: notificationId,
        userEmail,
        title,
        body: message,
        type: 'push',
        relatedTaskId: taskId,
        isRead: false,
        data: sanitizeJsonValue({
          type: 'task-reminder',
          taskId,
          taskTitle: title,
        }) as Prisma.InputJsonValue,
      },
    });

    const payload = {
      title,
      body: message,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: `task-${taskId}`,
      data: {
        type: 'task-reminder',
        taskId,
        taskTitle: title,
        notificationId,
        userEmail,
        url: `/task/${taskId}`,
      },
    };

    const results = await Promise.all(
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

          return {
            success: false,
            error: 'Invalid subscription payload',
            subscriptionId: subscriptionRow.id,
          };
        }

        try {
          await webpush.sendNotification(canonical, JSON.stringify(payload));

          await prisma.pushSubscription.update({
            where: { id: subscriptionRow.id },
            data: { lastUsedAt: new Date() },
          });

          return { success: true, subscriptionId: subscriptionRow.id };
        } catch (error: unknown) {
          const webPushError = error as { statusCode?: number; message?: string };

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

          return {
            success: false,
            error: webPushError.message || 'Unknown error',
            subscriptionId: subscriptionRow.id,
          };
        }
      })
    );

    const successCount = results.filter((result) => result.success).length;
    const totalCount = results.length;

    if (successCount > 0) {
      await Promise.all([
        prisma.notification.update({
          where: { id: notificationId },
          data: { sentAt: new Date() },
        }),
        prisma.task.updateMany({
          where: {
            id: taskId,
            userEmail,
          },
          data: { notifiedAt: new Date() },
        }),
      ]);
    }

    return NextResponse.json({
      success: true,
      message: `Task reminder sent to ${successCount}/${totalCount} subscriptions`,
      taskId,
      userEmail,
      notificationId,
      notificationsSent: successCount,
      totalSubscriptions: totalCount,
      results,
    });
  } catch (error) {
    console.error('Error in send-task-reminder:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

