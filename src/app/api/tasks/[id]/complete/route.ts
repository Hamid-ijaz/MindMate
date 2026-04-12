import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUserEmail } from '@/lib/auth-utils';
import { taskPrismaService } from '@/services/server/task-prisma-service';

type RouteContext = {
  params: Promise<{ id: string }>;
};

type CompleteTaskBody = {
  newTaskData?: Record<string, unknown>;
};

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null;
};

const getTaskId = async (context: RouteContext): Promise<string> => {
  const { id } = await context.params;
  return id;
};

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const authenticatedUserEmail = await getAuthenticatedUserEmail(request);
    if (!authenticatedUserEmail) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const taskId = await getTaskId(context);
    const body = (await request.json()) as CompleteTaskBody;

    if (!isRecord(body.newTaskData)) {
      return NextResponse.json({ error: 'newTaskData is required' }, { status: 400 });
    }

    const newTaskId = await taskPrismaService.completeAndReschedule(
      taskId,
      authenticatedUserEmail,
      body.newTaskData as any
    );

    if (!newTaskId) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, newTaskId });
  } catch (error) {
    console.error('Error completing and rescheduling task:', error);
    return NextResponse.json(
      { error: 'Failed to complete and reschedule task' },
      { status: 500 }
    );
  }
}
