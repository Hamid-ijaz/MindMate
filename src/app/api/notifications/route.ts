import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedUserEmail } from '@/lib/auth-utils';
import type { NotificationData, NotificationDocument, NotificationStats } from '@/lib/types';
import type { Notification as PrismaNotification } from '@prisma/client';
import type { Prisma } from '@prisma/client';

type NotificationAction = 'markRead' | 'markAllRead' | 'deleteOne' | 'clearAll' | 'deleteByTaskId';

type NotificationPostBody = {
  userEmail?: string;
  title?: string;
  body?: string;
  type?: 'push' | 'in_app';
  relatedTaskId?: string;
  data?: NotificationData;
};

type NotificationPatchBody = {
  userEmail?: string;
  action?: NotificationAction;
  notificationId?: string;
};

type NotificationDeleteBody = {
  userEmail?: string;
  action?: NotificationAction;
  notificationId?: string;
  taskId?: string;
};

const MAX_LIST_LIMIT = 500;
const DEFAULT_LIST_LIMIT = 200;

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null;
};

const sanitizeJsonValue = (value: unknown): unknown => {
  if (value === undefined) {
    return null;
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeJsonValue(item));
  }

  if (isRecord(value)) {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, nestedValue]) => nestedValue !== undefined)
        .map(([key, nestedValue]) => [key, sanitizeJsonValue(nestedValue)])
    );
  }

  return value;
};

const toNotificationType = (value: string): 'push' | 'in_app' => {
  return value === 'push' ? 'push' : 'in_app';
};

const toNotificationDocument = (notification: PrismaNotification): NotificationDocument => {
  return {
    id: notification.id,
    userEmail: notification.userEmail,
    title: notification.title,
    body: notification.body,
    type: toNotificationType(notification.type),
    relatedTaskId: notification.relatedTaskId ?? undefined,
    isRead: notification.isRead,
    createdAt: notification.createdAt.getTime(),
    sentAt: notification.sentAt?.getTime(),
    readAt: notification.readAt?.getTime(),
    data: (notification.data as NotificationData | null) ?? undefined,
  };
};

const buildNotificationStats = (
  notifications: Array<Pick<PrismaNotification, 'type' | 'isRead' | 'createdAt' | 'data'>>
): NotificationStats => {
  const now = Date.now();
  const oneDayAgo = now - 24 * 60 * 60 * 1000;
  const oneWeekAgo = now - 7 * 24 * 60 * 60 * 1000;

  const unreadCount = notifications.filter((notification) => !notification.isRead).length;
  const notificationsByType = notifications.reduce((acc, notification) => {
    const data = isRecord(notification.data) ? notification.data : null;
    const typedValue = typeof data?.type === 'string' ? data.type : notification.type;

    acc[typedValue] = (acc[typedValue] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const createdAtValues = notifications.map((notification) => notification.createdAt.getTime());

  return {
    totalNotifications: notifications.length,
    unreadCount,
    notificationsByType,
    lastNotificationAt: createdAtValues.length > 0 ? Math.max(...createdAtValues) : undefined,
    dailyNotificationCount: createdAtValues.filter((createdAt) => createdAt > oneDayAgo).length,
    weeklyNotificationCount: createdAtValues.filter((createdAt) => createdAt > oneWeekAgo).length,
  };
};

const getAuthorizedEmail = async (
  request: NextRequest,
  requestedUserEmail?: string | null
): Promise<{ userEmail: string } | { error: NextResponse }> => {
  const authenticatedUserEmail = await getAuthenticatedUserEmail(request);
  if (!authenticatedUserEmail) {
    return { error: NextResponse.json({ error: 'Not authenticated' }, { status: 401 }) };
  }

  const userEmail = requestedUserEmail ?? authenticatedUserEmail;

  if (authenticatedUserEmail !== userEmail) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }

  return { userEmail };
};

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const authorization = await getAuthorizedEmail(request, searchParams.get('userEmail'));
    if ('error' in authorization) {
      return authorization.error;
    }

    const statsRequested = searchParams.get('stats') === '1' || searchParams.get('stats') === 'true';

    if (statsRequested) {
      const notifications = await prisma.notification.findMany({
        where: { userEmail: authorization.userEmail },
        select: {
          type: true,
          isRead: true,
          createdAt: true,
          data: true,
        },
      });

      return NextResponse.json({ stats: buildNotificationStats(notifications) });
    }

    const requestedLimit = Number(searchParams.get('limit'));
    const limit = Number.isFinite(requestedLimit)
      ? Math.max(1, Math.min(MAX_LIST_LIMIT, Math.floor(requestedLimit)))
      : DEFAULT_LIST_LIMIT;

    const notifications = await prisma.notification.findMany({
      where: { userEmail: authorization.userEmail },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return NextResponse.json({
      notifications: notifications.map(toNotificationDocument),
    });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    return NextResponse.json({ error: 'Failed to fetch notifications' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as NotificationPostBody;

    const authorization = await getAuthorizedEmail(request, body.userEmail);
    if ('error' in authorization) {
      return authorization.error;
    }

    if (!body.title || !body.body) {
      return NextResponse.json(
        { error: 'title and body are required' },
        { status: 400 }
      );
    }

    const createdNotification = await prisma.notification.create({
      data: {
        userEmail: authorization.userEmail,
        title: body.title,
        body: body.body,
        type: body.type === 'push' ? 'push' : 'in_app',
        relatedTaskId: body.relatedTaskId ?? body.data?.taskId ?? null,
        isRead: false,
        data: body.data
          ? (sanitizeJsonValue(body.data) as Prisma.InputJsonValue)
          : undefined,
      },
      select: { id: true },
    });

    return NextResponse.json({
      success: true,
      notificationId: createdNotification.id,
    });
  } catch (error) {
    console.error('Error creating notification:', error);
    return NextResponse.json({ error: 'Failed to create notification' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = (await request.json()) as NotificationPatchBody;

    const authorization = await getAuthorizedEmail(request, body.userEmail);
    if ('error' in authorization) {
      return authorization.error;
    }

    const action = body.action;

    if (action === 'markRead') {
      if (!body.notificationId) {
        return NextResponse.json({ error: 'notificationId is required' }, { status: 400 });
      }

      const result = await prisma.notification.updateMany({
        where: {
          id: body.notificationId,
          userEmail: authorization.userEmail,
        },
        data: {
          isRead: true,
          readAt: new Date(),
        },
      });

      return NextResponse.json({ success: true, updatedCount: result.count });
    }

    if (action === 'markAllRead') {
      const result = await prisma.notification.updateMany({
        where: {
          userEmail: authorization.userEmail,
          isRead: false,
        },
        data: {
          isRead: true,
          readAt: new Date(),
        },
      });

      return NextResponse.json({ success: true, updatedCount: result.count });
    }

    return NextResponse.json({ error: 'Unsupported action' }, { status: 400 });
  } catch (error) {
    console.error('Error updating notifications:', error);
    return NextResponse.json({ error: 'Failed to update notifications' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = (await request.json()) as NotificationDeleteBody;

    const authorization = await getAuthorizedEmail(request, body.userEmail);
    if ('error' in authorization) {
      return authorization.error;
    }

    if (body.action === 'deleteOne') {
      if (!body.notificationId) {
        return NextResponse.json({ error: 'notificationId is required' }, { status: 400 });
      }

      const result = await prisma.notification.deleteMany({
        where: {
          id: body.notificationId,
          userEmail: authorization.userEmail,
        },
      });

      return NextResponse.json({ success: true, deletedCount: result.count });
    }

    if (body.action === 'clearAll') {
      const result = await prisma.notification.deleteMany({
        where: { userEmail: authorization.userEmail },
      });

      return NextResponse.json({ success: true, deletedCount: result.count });
    }

    if (body.action === 'deleteByTaskId') {
      if (!body.taskId) {
        return NextResponse.json({ error: 'taskId is required' }, { status: 400 });
      }

      const notifications = await prisma.notification.findMany({
        where: { userEmail: authorization.userEmail },
        select: {
          id: true,
          relatedTaskId: true,
          data: true,
        },
      });

      const matchingIds = notifications
        .filter((notification) => {
          if (notification.relatedTaskId === body.taskId) {
            return true;
          }

          if (!isRecord(notification.data)) {
            return false;
          }

          return notification.data.taskId === body.taskId;
        })
        .map((notification) => notification.id);

      if (matchingIds.length === 0) {
        return NextResponse.json({ success: true, deletedCount: 0 });
      }

      const result = await prisma.notification.deleteMany({
        where: {
          userEmail: authorization.userEmail,
          id: {
            in: matchingIds,
          },
        },
      });

      return NextResponse.json({ success: true, deletedCount: result.count });
    }

    return NextResponse.json({ error: 'Unsupported action' }, { status: 400 });
  } catch (error) {
    console.error('Error deleting notifications:', error);
    return NextResponse.json({ error: 'Failed to delete notifications' }, { status: 500 });
  }
}
