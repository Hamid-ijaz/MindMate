import { NextRequest, NextResponse } from 'next/server';
import { emailService } from '@/lib/email';
import { prisma } from '@/lib/prisma';
import { taskPrismaService } from '@/services/server/task-prisma-service';
import { userPrismaService } from '@/services/server/user-prisma-service';

type ReminderTask = {
  id: string;
  title: string;
  description?: string | null;
  priority?: string | null;
  reminderAt?: Date | null;
  notifiedAt?: Date | null;
};

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
      taskPrismaService.getTask(taskId, userEmail),
      userPrismaService.getUser(userEmail)
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
      dueDate: task.reminderAt,
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
      await taskPrismaService.updateTask(taskId, userEmail, {
        notifiedAt: Date.now(),
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
        const user = await userPrismaService.getUser(userEmail);
        if (!user) continue;

        const taskLink = `${process.env.NEXT_PUBLIC_URL || 'http://localhost:3000'}/task/${task.id}`;

        const templateData = {
          userName: user.firstName || 'there',
          taskTitle: task.title,
          taskDescription: task.description,
          dueDate: task.reminderAt,
          priority: task.priority,
          taskLink,
          companyName: process.env.EMAIL_COMPANY_NAME || 'MindMate',
          companyUrl: process.env.EMAIL_COMPANY_URL || 'https://mindmate.app',
          supportEmail: process.env.EMAIL_SUPPORT_EMAIL || 'support@mindmate.app',
        };

        const success = await emailService.sendTaskReminderEmail(userEmail, templateData);

        if (success) {
          await taskPrismaService.updateTask(task.id, userEmail, {
            notifiedAt: Date.now(),
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

async function getDueTasksForReminders(batchSize: number): Promise<Array<{ userEmail: string; task: ReminderTask }>> {
  try {
    const now = new Date();
    const reminderThreshold = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours from now

    const tasks = await prisma.task.findMany({
      where: {
        completedAt: null,
        reminderAt: {
          gt: now,
          lte: reminderThreshold,
        },
      },
      orderBy: {
        reminderAt: 'asc',
      },
      take: batchSize,
      select: {
        id: true,
        userEmail: true,
        title: true,
        description: true,
        priority: true,
        reminderAt: true,
        notifiedAt: true,
      },
    });

    return tasks
      .filter((task) => shouldSendReminder(task))
      .map((task) => ({
        userEmail: task.userEmail,
        task: {
          id: task.id,
          title: task.title,
          description: task.description,
          priority: task.priority,
          reminderAt: task.reminderAt,
          notifiedAt: task.notifiedAt,
        },
      }));
  } catch (error) {
    console.error('Error getting due tasks for reminders:', error);
    return [];
  }
}

function shouldSendReminder(task: ReminderTask): boolean {
  const now = new Date();
  const lastReminderSent = task.notifiedAt ? new Date(task.notifiedAt) : null;
  
  // Don't send reminder if one was sent in the last 4 hours
  if (lastReminderSent && (now.getTime() - lastReminderSent.getTime()) < 4 * 60 * 60 * 1000) {
    return false;
  }
  
  return true;
}
