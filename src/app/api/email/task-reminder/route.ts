import { NextRequest, NextResponse } from 'next/server';
import { emailService } from '@/lib/email';
import { taskService, userService } from '@/lib/firestore';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { taskId, userEmail, customMessage } = body;

    if (!taskId || !userEmail) {
      return NextResponse.json(
        { error: 'taskId and userEmail are required' },
        { status: 400 }
      );
    }

    // Get task and user information
    const [task, user] = await Promise.all([
      taskService.getTask(userEmail, taskId),
      userService.getUser(userEmail)
    ]);

    if (!task) {
      return NextResponse.json(
        { error: 'Task not found' },
        { status: 404 }
      );
    }

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Generate task link
    const taskLink = `${process.env.NEXT_PUBLIC_URL || 'http://localhost:3000'}/task/${taskId}`;

    const templateData = {
      userName: user.firstName || 'there',
      taskTitle: task.title,
      taskDescription: task.description,
      dueDate: task.dueDate,
      priority: task.priority,
      taskLink,
      customMessage,
      companyName: process.env.EMAIL_COMPANY_NAME || 'MindMate',
      companyUrl: process.env.EMAIL_COMPANY_URL || 'https://mindmate.app',
      supportEmail: process.env.EMAIL_SUPPORT_EMAIL || 'support@mindmate.app',
    };

    const success = await emailService.sendTaskReminderEmail(userEmail, templateData);

    if (success) {
      // Update task with reminder sent timestamp
      await taskService.updateTask(userEmail, taskId, {
        lastReminderSent: new Date(),
        reminderCount: (task.reminderCount || 0) + 1,
      });

      return NextResponse.json({ 
        success: true, 
        message: 'Task reminder email sent successfully' 
      });
    } else {
      return NextResponse.json(
        { error: 'Failed to send task reminder email' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error in task-reminder:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET endpoint for bulk reminder processing
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const batchSize = parseInt(url.searchParams.get('batchSize') || '50');
    
    // This endpoint can be called by a cron job to send scheduled reminders
    const dueTasks = await getDueTasksForReminders(batchSize);
    
    const results = [];
    
    for (const { userEmail, task } of dueTasks) {
      try {
        const user = await userService.getUser(userEmail);
        if (!user) continue;

        const taskLink = `${process.env.NEXT_PUBLIC_URL || 'http://localhost:3000'}/task/${task.id}`;

        const templateData = {
          userName: user.firstName || 'there',
          taskTitle: task.title,
          taskDescription: task.description,
          dueDate: task.dueDate,
          priority: task.priority,
          taskLink,
          companyName: process.env.EMAIL_COMPANY_NAME || 'MindMate',
          companyUrl: process.env.EMAIL_COMPANY_URL || 'https://mindmate.app',
          supportEmail: process.env.EMAIL_SUPPORT_EMAIL || 'support@mindmate.app',
        };

        const success = await emailService.sendTaskReminderEmail(userEmail, templateData);

        if (success) {
          await taskService.updateTask(userEmail, task.id, {
            lastReminderSent: new Date(),
            reminderCount: (task.reminderCount || 0) + 1,
          });
        }

        results.push({
          userEmail,
          taskId: task.id,
          taskTitle: task.title,
          success,
        });
      } catch (error) {
        console.error(`Error sending reminder for task ${task.id}:`, error);
        results.push({
          userEmail,
          taskId: task.id,
          taskTitle: task.title,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    const successCount = results.filter(r => r.success).length;

    return NextResponse.json({
      success: true,
      message: `Processed ${results.length} reminders, ${successCount} sent successfully`,
      results,
    });
  } catch (error) {
    console.error('Error in bulk task reminders:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

async function getDueTasksForReminders(batchSize: number): Promise<Array<{ userEmail: string; task: any }>> {
  try {
    const { initializeApp, getApps, cert } = await import('firebase-admin/app');
    const { getFirestore } = await import('firebase-admin/firestore');

    if (!getApps().length) {
      initializeApp({
        credential: cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        }),
      });
    }

    const db = getFirestore();
    const now = new Date();
    const reminderThreshold = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours from now

    // Query tasks that are due within the next 24 hours and haven't been reminded recently
    const tasksSnapshot = await db.collectionGroup('tasks')
      .where('completed', '==', false)
      .where('dueDate', '<=', reminderThreshold)
      .where('dueDate', '>', now)
      .limit(batchSize)
      .get();

    const dueTasks = [];
    
    for (const doc of tasksSnapshot.docs) {
      const task = { id: doc.id, ...doc.data() };
      const userEmail = doc.ref.parent.parent?.id;
      
      if (userEmail && shouldSendReminder(task)) {
        dueTasks.push({ userEmail, task });
      }
    }

    return dueTasks;
  } catch (error) {
    console.error('Error getting due tasks for reminders:', error);
    return [];
  }
}

function shouldSendReminder(task: any): boolean {
  const now = new Date();
  const lastReminderSent = task.lastReminderSent ? new Date(task.lastReminderSent) : null;
  
  // Don't send reminder if one was sent in the last 4 hours
  if (lastReminderSent && (now.getTime() - lastReminderSent.getTime()) < 4 * 60 * 60 * 1000) {
    return false;
  }
  
  // Don't send more than 3 reminders per task
  if ((task.reminderCount || 0) >= 3) {
    return false;
  }
  
  return true;
}
