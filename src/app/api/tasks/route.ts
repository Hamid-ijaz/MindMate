import { NextRequest, NextResponse } from 'next/server';
import { taskService } from '@/lib/firestore';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userEmail = searchParams.get('userEmail');
    
    if (!userEmail) {
      return NextResponse.json({ error: 'User email is required' }, { status: 400 });
    }
    
    const tasks = await taskService.getTasks(userEmail);
    return NextResponse.json({ tasks });
  } catch (error) {
    console.error('Error fetching tasks:', error);
    return NextResponse.json({ error: 'Failed to fetch tasks' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    console.log('📝 POST /api/tasks - Task creation request received');

    const body = await request.json();
    const { userEmail, task } = body;

    console.log('📋 POST /api/tasks - Request data:', {
      hasUserEmail: !!userEmail,
      hasTask: !!task,
      taskTitle: task?.title,
      taskSyncToGoogleTasks: task?.syncToGoogleTasks
    });

    if (!userEmail || !task) {
      console.log('❌ POST /api/tasks - Missing required data');
      return NextResponse.json({ error: 'User email and task data are required' }, { status: 400 });
    }

    console.log(`👤 POST /api/tasks - Creating task for user: ${userEmail}`);
    const taskId = await taskService.addTask(userEmail, task);

    console.log(`✅ POST /api/tasks - Task created successfully:`, {
      taskId,
      title: task.title,
      syncToGoogleTasks: task.syncToGoogleTasks
    });

    return NextResponse.json({ taskId });
  } catch (error) {
    console.error('❌ POST /api/tasks - Error creating task:', error);
    return NextResponse.json({ error: 'Failed to create task' }, { status: 500 });
  }
}
