import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUserEmail } from '@/lib/auth-utils';
import { taskService } from '@/lib/firestore';

export async function POST(request: NextRequest) {
  try {
    const userEmail = await getAuthenticatedUserEmail(request);
    if (!userEmail) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    console.log(`🧹 Starting to clear googleTaskId for incomplete tasks for user: ${userEmail}`);

    // Get all tasks for the user
    const allTasks = await taskService.getTasks(userEmail);

    // Filter incomplete tasks (tasks that are not completed)
    const incompleteTasks = allTasks.filter(task => !task.completedAt);

    console.log(`📊 Found ${incompleteTasks.length} incomplete tasks to process`);

    let clearedCount = 0;
    let skippedCount = 0;
    const errors: string[] = [];

    // Process each incomplete task
    for (const task of incompleteTasks) {
      try {
        // Only clear if it has a googleTaskId
        if (task.googleTaskId) {
          await taskService.updateTask(task.id, {
            googleTaskId: null,
            googleTaskSyncStatus: 'pending',
            googleTaskLastSync: Date.now()
          });
          clearedCount++;
          console.log(`✅ Cleared googleTaskId for task: ${task.title}`);
        } else {
          skippedCount++;
          console.log(`⏭️ Skipped task (no googleTaskId): ${task.title}`);
        }
      } catch (error) {
        const errorMsg = `Failed to clear googleTaskId for task "${task.title}": ${error instanceof Error ? error.message : 'Unknown error'}`;
        errors.push(errorMsg);
        console.error(`❌ ${errorMsg}`);
      }
    }

    const result = {
      success: errors.length === 0,
      totalTasks: incompleteTasks.length,
      clearedCount,
      skippedCount,
      errors,
      message: `Cleared googleTaskId from ${clearedCount} incomplete tasks, skipped ${skippedCount} tasks`
    };

    console.log(`🎉 Clear operation completed:`, result);

    return NextResponse.json(result);
  } catch (error) {
    console.error('❌ Error in clear-google-task-ids API:', error);
    return NextResponse.json(
      {
        error: 'Failed to clear googleTaskId',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
