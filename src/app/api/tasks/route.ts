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
    const body = await request.json();
    const { userEmail, task } = body;
    
    if (!userEmail || !task) {
      return NextResponse.json({ error: 'User email and task data are required' }, { status: 400 });
    }
    
    const taskId = await taskService.addTask(userEmail, task);
    return NextResponse.json({ taskId });
  } catch (error) {
    console.error('Error creating task:', error);
    return NextResponse.json({ error: 'Failed to create task' }, { status: 500 });
  }
}
