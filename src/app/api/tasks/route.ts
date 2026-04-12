import { NextRequest, NextResponse } from 'next/server';
import {
  taskPrismaService,
  type TaskCreateInput,
} from '@/services/server/task-prisma-service';
import { getAuthenticatedUserEmail } from '@/lib/auth-utils';

type CreateTaskBody = {
  userEmail?: string;
  task?: Record<string, unknown>;
  parentTask?: Record<string, unknown>;
  subtasks?: Record<string, unknown>[];
};

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null;
};

const isTaskCreateInput = (value: unknown): value is TaskCreateInput => {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.title === 'string' &&
    typeof value.category === 'string' &&
    typeof value.priority === 'string' &&
    typeof value.duration === 'number'
  );
};

export async function GET(request: NextRequest) {
  try {
    const authenticatedUserEmail = await getAuthenticatedUserEmail(request);
    if (!authenticatedUserEmail) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const requestedUserEmail = searchParams.get('userEmail');
    const userEmail = requestedUserEmail ?? authenticatedUserEmail;

    if (authenticatedUserEmail !== userEmail) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    
    const tasks = await taskPrismaService.getTasks(userEmail);
    return NextResponse.json({ tasks });
  } catch (error) {
    console.error('Error fetching tasks:', error);
    return NextResponse.json({ error: 'Failed to fetch tasks' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const authenticatedUserEmail = await getAuthenticatedUserEmail(request);
    if (!authenticatedUserEmail) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const body = (await request.json()) as CreateTaskBody;
    const requestedUserEmail = typeof body.userEmail === 'string' ? body.userEmail : undefined;
    const userEmail = requestedUserEmail ?? authenticatedUserEmail;

    if (authenticatedUserEmail !== userEmail) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (isTaskCreateInput(body.parentTask)) {
      const subtasks = Array.isArray(body.subtasks)
        ? body.subtasks.filter(isTaskCreateInput)
        : [];

      const result = await taskPrismaService.addTaskWithSubtasks(
        userEmail,
        body.parentTask,
        subtasks
      );

      return NextResponse.json({
        success: true,
        ...result,
      });
    }

    if (!isTaskCreateInput(body.task)) {
      return NextResponse.json({ error: 'Task data is required' }, { status: 400 });
    }

    const taskId = await taskPrismaService.addTask(userEmail, body.task);

    return NextResponse.json({ success: true, taskId });
  } catch (error) {
    console.error('Error creating task:', error);
    return NextResponse.json({ error: 'Failed to create task' }, { status: 500 });
  }
}
