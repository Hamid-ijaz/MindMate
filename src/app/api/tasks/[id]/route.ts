import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUserEmail } from '@/lib/auth-utils';
import { taskPrismaService } from '@/services/server/task-prisma-service';

type RouteContext = {
  params: Promise<{ id: string }>;
};

type PatchTaskBody = {
  updates?: Record<string, unknown>;
  clearFields?: string[];
};

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null;
};

const getRouteId = async (context: RouteContext): Promise<string> => {
  const { id } = await context.params;
  return id;
};

const applyClearFields = (
  updates: Record<string, unknown>,
  clearFields?: string[]
): Record<string, unknown> => {
  const mergedUpdates = { ...updates };

  if (!Array.isArray(clearFields)) {
    return mergedUpdates;
  }

  for (const field of clearFields) {
    if (typeof field === 'string' && !(field in mergedUpdates)) {
      mergedUpdates[field] = null;
    }
  }

  return mergedUpdates;
};

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const authenticatedUserEmail = await getAuthenticatedUserEmail(request);
    if (!authenticatedUserEmail) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const taskId = await getRouteId(context);
    const task = await taskPrismaService.getTask(taskId, authenticatedUserEmail);

    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    return NextResponse.json({ task });
  } catch (error) {
    console.error('Error fetching task:', error);
    return NextResponse.json({ error: 'Failed to fetch task' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const authenticatedUserEmail = await getAuthenticatedUserEmail(request);
    if (!authenticatedUserEmail) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const taskId = await getRouteId(context);
    const body = (await request.json()) as PatchTaskBody | Record<string, unknown>;

    const updatesFromBody =
      isRecord((body as PatchTaskBody).updates)
        ? (body as PatchTaskBody).updates
        : isRecord(body)
          ? body
          : null;

    if (!updatesFromBody) {
      return NextResponse.json({ error: 'Task updates are required' }, { status: 400 });
    }

    const clearFields = Array.isArray((body as PatchTaskBody).clearFields)
      ? (body as PatchTaskBody).clearFields
      : undefined;

    const updates = applyClearFields(updatesFromBody, clearFields);
    const task = await taskPrismaService.updateTask(taskId, authenticatedUserEmail, updates as any);

    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, task });
  } catch (error) {
    console.error('Error updating task:', error);
    return NextResponse.json({ error: 'Failed to update task' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const authenticatedUserEmail = await getAuthenticatedUserEmail(request);
    if (!authenticatedUserEmail) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const taskId = await getRouteId(context);
    const deleted = await taskPrismaService.deleteTask(taskId, authenticatedUserEmail);

    return NextResponse.json({ success: true, deleted });
  } catch (error) {
    console.error('Error deleting task:', error);
    return NextResponse.json({ error: 'Failed to delete task' }, { status: 500 });
  }
}
