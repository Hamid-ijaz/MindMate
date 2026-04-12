import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUserEmail, isAuthorizedCronRequest } from '@/lib/auth-utils';
import { prisma } from '@/lib/prisma';

type RouteBody = {
  userId?: string;
};

const mapTaskForResponse = (task: {
  id: string;
  userEmail: string;
  title: string;
  description: string | null;
  category: string;
  priority: string;
  duration: number;
  createdAt: Date;
  updatedAt: Date | null;
  rejectionCount: number;
  lastRejectedAt: Date | null;
  isMuted: boolean;
  isArchived: boolean;
  completedAt: Date | null;
  parentId: string | null;
  reminderAt: Date | null;
  onlyNotifyAtReminder: boolean;
  notifiedAt: Date | null;
  recurrence: unknown;
  scheduledAt: Date | null;
  scheduledEndAt: Date | null;
  isTimeBlocked: boolean | null;
  calendarEventId: string | null;
  pomodoroSessions: number | null;
  estimatedPomodoros: number | null;
  timeSpent: number | null;
  isAllDay: boolean | null;
  calendarColor: string | null;
  location: string | null;
  attendees: unknown;
  isRecurring: boolean | null;
  originalTaskId: string | null;
}) => ({
  id: task.id,
  userEmail: task.userEmail,
  title: task.title,
  description: task.description,
  category: task.category,
  priority: task.priority,
  duration: task.duration,
  createdAt: task.createdAt,
  updatedAt: task.updatedAt,
  rejectionCount: task.rejectionCount,
  lastRejectedAt: task.lastRejectedAt,
  isMuted: task.isMuted,
  isArchived: task.isArchived,
  completedAt: task.completedAt,
  completed: task.completedAt !== null,
  parentId: task.parentId,
  reminderAt: task.reminderAt,
  dueDate: task.reminderAt,
  onlyNotifyAtReminder: task.onlyNotifyAtReminder,
  notifiedAt: task.notifiedAt,
  recurrence: task.recurrence,
  scheduledAt: task.scheduledAt,
  scheduledEndAt: task.scheduledEndAt,
  isTimeBlocked: task.isTimeBlocked,
  calendarEventId: task.calendarEventId,
  pomodoroSessions: task.pomodoroSessions,
  estimatedPomodoros: task.estimatedPomodoros,
  timeSpent: task.timeSpent,
  isAllDay: task.isAllDay,
  calendarColor: task.calendarColor,
  location: task.location,
  attendees: task.attendees,
  isRecurring: task.isRecurring,
  originalTaskId: task.originalTaskId,
});

const buildResponse = async (userId: string) => {
  const now = new Date();
  const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);

  const [overdueTaskRows, upcomingTaskRows] = await Promise.all([
    prisma.task.findMany({
      where: {
        userEmail: userId,
        completedAt: null,
        reminderAt: { lte: now },
        isMuted: false,
      },
      orderBy: { reminderAt: 'asc' },
    }),
    prisma.task.findMany({
      where: {
        userEmail: userId,
        completedAt: null,
        reminderAt: { gt: now, lte: oneHourFromNow },
        isMuted: false,
      },
      orderBy: { reminderAt: 'asc' },
    }),
  ]);

  const overdueTasks = overdueTaskRows.map(mapTaskForResponse);
  const upcomingTasks = upcomingTaskRows.map(mapTaskForResponse);

  return {
    success: true,
    userId,
    overdueTasks: {
      count: overdueTasks.length,
      tasks: overdueTasks,
    },
    upcomingTasks: {
      count: upcomingTasks.length,
      tasks: upcomingTasks,
    },
    checkedAt: now.toISOString(),
  };
};

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as RouteBody;
    const { userId } = body;
    const authenticatedUserEmail = await getAuthenticatedUserEmail(request);
    const isCronRequest = isAuthorizedCronRequest(request);

    if (!isCronRequest && !authenticatedUserEmail) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    if (!userId) {
      return NextResponse.json(
        { error: 'Missing required field: userId' },
        { status: 400 }
      );
    }

    if (!isCronRequest && authenticatedUserEmail !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    return NextResponse.json(await buildResponse(userId));
  } catch (error) {
    console.error('Error in check-overdue-tasks:', error);
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
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const authenticatedUserEmail = await getAuthenticatedUserEmail(request);
    const isCronRequest = isAuthorizedCronRequest(request);

    if (!isCronRequest && !authenticatedUserEmail) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    if (!userId) {
      return NextResponse.json(
        { error: 'Missing required query parameter: userId' },
        { status: 400 }
      );
    }

    if (!isCronRequest && authenticatedUserEmail !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    return NextResponse.json(await buildResponse(userId));
  } catch (error) {
    console.error('Error in check-overdue-tasks:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

