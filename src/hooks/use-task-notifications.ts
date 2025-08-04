'use client';

import { useAuth } from '@/contexts/auth-context';
import { useCallback } from 'react';

interface TaskNotificationOptions {
  taskId: string;
  title: string;
  message: string;
  type?: 'reminder' | 'overdue' | 'completion';
  scheduleFor?: Date;
}

interface NotificationHelper {
  scheduleTaskReminder: (options: TaskNotificationOptions) => Promise<boolean>;
  sendTaskNotification: (options: TaskNotificationOptions) => Promise<boolean>;
  cancelTaskReminder: (taskId: string) => Promise<boolean>;
  sendOverdueAlert: (taskIds: string[]) => Promise<boolean>;
}

export function useTaskNotifications(): NotificationHelper {
  const { user } = useAuth();

  const scheduleTaskReminder = useCallback(async (options: TaskNotificationOptions): Promise<boolean> => {
    if (!user?.email) return false;

    try {
      // For now, we'll use the immediate notification API
      // In a production app, you'd want a scheduler service
      const response = await fetch('/api/notifications/send-task-reminder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskId: options.taskId,
          userEmail: user.email,
          title: options.title,
          message: options.message
        })
      });

      const data = await response.json();
      return data.success;
    } catch (error) {
      console.error('Failed to schedule task reminder:', error);
      return false;
    }
  }, [user?.email]);

  const sendTaskNotification = useCallback(async (options: TaskNotificationOptions): Promise<boolean> => {
    if (!user?.email) return false;

    try {
      const response = await fetch('/api/notifications/send-task-reminder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskId: options.taskId,
          userEmail: user.email,
          title: options.title,
          message: options.message
        })
      });

      const data = await response.json();
      return data.success;
    } catch (error) {
      console.error('Failed to send task notification:', error);
      return false;
    }
  }, [user?.email]);

  const cancelTaskReminder = useCallback(async (taskId: string): Promise<boolean> => {
    // This would cancel scheduled notifications for a task
    // For now, we don't have a cancellation API, but it would be implemented here
    console.log('Cancel reminder for task:', taskId);
    return true;
  }, []);

  const sendOverdueAlert = useCallback(async (taskIds: string[]): Promise<boolean> => {
    if (!user?.email || taskIds.length === 0) return false;

    try {
      // Send a generic overdue alert notification
      const response = await fetch('/api/notifications/send-task-reminder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskId: taskIds[0], // Use first task ID for navigation
          userEmail: user.email,
          title: 'Overdue Tasks Alert',
          message: `You have ${taskIds.length} overdue task${taskIds.length !== 1 ? 's' : ''} that need attention`
        })
      });

      const data = await response.json();
      return data.success;
    } catch (error) {
      console.error('Failed to send overdue alert:', error);
      return false;
    }
  }, [user?.email]);

  return {
    scheduleTaskReminder,
    sendTaskNotification,
    cancelTaskReminder,
    sendOverdueAlert
  };
}
