import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUserEmail } from '@/lib/auth-utils';
import { taskPrismaService } from '@/services/server/task-prisma-service';

type RouteContext = {
  params: Promise<{ id: string }>;
};

const getParentTaskId = async (context: RouteContext): Promise<string> => {
  const { id } = await context.params;
  return id;
};

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const authenticatedUserEmail = await getAuthenticatedUserEmail(request);
    if (!authenticatedUserEmail) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const parentId = await getParentTaskId(context);
    const deletedCount = await taskPrismaService.deleteTasksWithParentId(
      parentId,
      authenticatedUserEmail
    );

    return NextResponse.json({ success: true, deletedCount });
  } catch (error) {
    console.error('Error deleting subtasks:', error);
    return NextResponse.json({ error: 'Failed to delete subtasks' }, { status: 500 });
  }
}
