import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

const normalizeUserEmail = (value: unknown): string | null => {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  return normalized.length > 0 ? normalized : null;
};

export async function POST(request: NextRequest) {
  try {

    const body = await request.json().catch(() => ({}));
    const { notificationId, taskId } = body || {};
    const userEmail = normalizeUserEmail(body?.userEmail);

    // Prefer direct update by userEmail + notificationId to avoid collectionGroup queries
    if (!notificationId && !taskId) {
      return NextResponse.json({ error: 'Provide notificationId or taskId' }, { status: 400 });
    }

    // If specific notificationId provided, require userEmail to update a direct notification row
    if (notificationId) {
      if (!userEmail) {
        return NextResponse.json({ error: 'notificationId operations require userEmail in body' }, { status: 400 });
      }

      const existingNotification = await prisma.notification.findFirst({
        where: {
          id: notificationId,
          userEmail,
        },
        select: { id: true },
      });

      if (!existingNotification) {
        return NextResponse.json({ success: true, updated: 0, message: 'No matching notification found' });
      }

      await prisma.notification.updateMany({
        where: {
          id: notificationId,
          userEmail,
        },
        data: {
          isRead: true,
          readAt: new Date(),
        },
      });

      return NextResponse.json({ success: true, updated: 1 });
    }

    // If taskId provided, mark all unread notifications related to that task as read
    if (taskId) {
      if (!userEmail) {
        return NextResponse.json({ error: 'taskId operations require userEmail in body' }, { status: 400 });
      }

      const result = await prisma.notification.updateMany({
        where: {
          userEmail,
          relatedTaskId: taskId,
          isRead: false,
        },
        data: {
          isRead: true,
          readAt: new Date(),
        },
      });

      if (result.count === 0) {
        return NextResponse.json({ success: true, updated: 0, message: 'No unread notifications for this task' });
      }

      return NextResponse.json({ success: true, updated: result.count });
    }

    return NextResponse.json({ success: false, message: 'No action taken' }, { status: 400 });
  } catch (error: any) {
    console.error('Error in notifications/dismiss:', error);
    return NextResponse.json({ error: error?.message || String(error) }, { status: 500 });
  }
}
