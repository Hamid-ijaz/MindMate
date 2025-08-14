import { usePushNotifications } from '@/hooks/use-push-notifications';
import { Task } from '@/lib/types';
import { sendTaskReminder as sendTaskReminderAPI } from '@/lib/vercel-api';
import { useAuth } from '@/contexts/auth-context';

export interface PushNotificationHelper {
  sendTaskReminder: (task: Task, forceServerSide?: boolean) => Promise<boolean>;
  scheduleTaskReminder: (task: Task) => Promise<boolean>;
  sendOverdueNotification: (tasks: Task[]) => Promise<boolean>;
}

export function usePushNotificationHelper(): PushNotificationHelper {
  const { sendNotification, isSupported, permission } = usePushNotifications();
  const { user } = useAuth();

  const sendTaskReminder = async (task: Task, forceServerSide = false): Promise<boolean> => {
    // If forcing server-side or client-side notifications aren't supported, use Vercel API
    if (forceServerSide || !isSupported || permission !== 'granted') {
      if (user?.email) {
        try {
          const now = new Date();
          const dueDate = task.reminderAt ? new Date(task.reminderAt) : null;
          const isOverdue = dueDate && dueDate <= now;
          
          let title: string;
          let body: string;
          
          if (isOverdue) {
            const daysSinceDue = dueDate ? Math.floor((now.getTime() - dueDate.getTime()) / (24 * 60 * 60 * 1000)) : 0;
            title = "📋 Overdue Task";
            body = `"${task.title}" is ${daysSinceDue === 0 ? 'due today' : `${daysSinceDue} day${daysSinceDue > 1 ? 's' : ''} overdue`}`;
          } else {
            title = "⏰ Task Reminder";
            body = `"${task.title}" is due${dueDate ? ` ${formatDueDate(dueDate)}` : ''}`;
          }

          await sendTaskReminderAPI(task.id, user.email, title, body);
          return true;
        } catch (error) {
          console.error('Failed to send server-side task reminder:', error);
          return false;
        }
      }
      return false;
    }

    // Use client-side notifications
    const now = new Date();
    const dueDate = task.dueDate ? new Date(task.dueDate) : null;
    const isOverdue = dueDate && dueDate <= now;
    
    let title: string;
    let body: string;
    
    if (isOverdue) {
      const daysSinceDue = dueDate ? Math.floor((now.getTime() - dueDate.getTime()) / (24 * 60 * 60 * 1000)) : 0;
      title = "📋 Overdue Task";
      body = `"${task.title}" is ${daysSinceDue === 0 ? 'due today' : `${daysSinceDue} day${daysSinceDue > 1 ? 's' : ''} overdue`}`;
    } else {
      title = "⏰ Task Reminder";
      body = `"${task.title}" is due${dueDate ? ` ${formatDueDate(dueDate)}` : ''}`;
    }

    return await sendNotification({
      title,
      body,
      data: {
        type: 'task-reminder',
        taskId: task.id,
        taskTitle: task.title,
        isOverdue,
      },
      actions: [
        {
          action: 'complete',
          title: '✅ Mark Done',
        },
        {
          action: 'snooze',
          title: '⏰ Snooze 1hr',
        }
      ],
      tag: `task-${task.id}`,
      requireInteraction: true,
    });
  };

  const scheduleTaskReminder = async (task: Task): Promise<boolean> => {
    // For client-side scheduling, we can use the browser's built-in scheduling
    // or rely on the server-side Vercel API to handle scheduled notifications
    
    if (!task.reminderAt) {
      return false;
    }

    const reminderTime = new Date(task.reminderAt);
    const now = new Date();
    
    if (reminderTime <= now) {
      // If reminder time is in the past or now, send immediately
      return await sendTaskReminder(task);
    }

    // For future reminders, we can use the Vercel API for server-side scheduling
    // But we can also set a local timer as a backup for short-term reminders
    const timeUntilReminder = reminderTime.getTime() - now.getTime();
    
    // Only set local timer for reminders within the next 24 hours
    if (timeUntilReminder <= 24 * 60 * 60 * 1000) {
      setTimeout(() => {
        sendTaskReminder(task);
      }, timeUntilReminder);
      
      return true;
    }

    // For longer-term reminders, we rely on server-side scheduling via cron jobs
    // The server will check for overdue tasks and send notifications accordingly
    return false;
  };

  const sendOverdueNotification = async (tasks: Task[]): Promise<boolean> => {
    if (!isSupported || permission !== 'granted' || tasks.length === 0) {
      return false;
    }

    const taskCount = tasks.length;
    const urgentTasks = tasks.filter(task => task.priority === 'high');
    
    let title: string;
    let body: string;
    
    if (taskCount === 1) {
      const task = tasks[0];
      const now = new Date();
      const dueDate = task.dueDate ? new Date(task.dueDate) : now;
      const daysSinceDue = Math.floor((now.getTime() - dueDate.getTime()) / (24 * 60 * 60 * 1000));
      
      title = `📋 Overdue Task Reminder`;
      body = `"${task.title}" is ${daysSinceDue === 0 ? 'due today' : `${daysSinceDue} day${daysSinceDue > 1 ? 's' : ''} overdue`}`;
    } else {
      title = `📋 ${taskCount} Overdue Tasks`;
      
      if (urgentTasks.length > 0) {
        body = `You have ${taskCount} overdue tasks, including ${urgentTasks.length} high priority. Tap to review.`;
      } else {
        body = `You have ${taskCount} overdue tasks that need attention. Tap to review.`;
      }
    }

    return await sendNotification({
      title,
      body,
      data: {
        type: 'overdue-tasks',
        taskIds: tasks.map(t => t.id),
        taskCount,
      },
      actions: [
        {
          action: 'view',
          title: '👀 View Tasks',
        },
        {
          action: 'dismiss',
          title: '❌ Dismiss',
        }
      ],
      tag: 'overdue-tasks',
      requireInteraction: true,
    });
  };

  return {
    sendTaskReminder,
    scheduleTaskReminder,
    sendOverdueNotification,
  };
}

function formatDueDate(date: Date): string {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  if (date.toDateString() === now.toDateString()) {
    return 'today';
  } else if (date.toDateString() === tomorrow.toDateString()) {
    return 'tomorrow';
  } else {
    return `on ${date.toLocaleDateString()}`;
  }
}