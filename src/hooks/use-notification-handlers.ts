
"use client";

import { useEffect } from 'react';
import { useTasks } from '@/contexts/task-context';
import { useNotifications } from '@/contexts/notification-context';

export function useSetupNotificationHandlers() {
  const { tasks, updateTask, acceptTask } = useTasks();
  const { sendNotification } = useNotifications();

  useEffect(() => {
    const checkReminders = () => {
      const now = Date.now();
      tasks.forEach(task => {
        if (
          !task.completedAt &&
          task.reminderAt &&
          task.reminderAt <= now &&
          !task.notifiedAt
        ) {
          sendNotification(`Reminder: ${task.title}`, {
            body: task.description || "It's time to get this done!",
            tag: task.id,
            data: { taskId: task.id },
            actions: { onComplete: acceptTask }
          });
          updateTask(task.id, { notifiedAt: now });
        }
      });
    };

    // Defer the initial check to avoid updating state during render
    const initialCheckTimeout = setTimeout(() => {
      checkReminders();
    }, 0);

    const intervalId = setInterval(checkReminders, 60 * 1000);

    return () => {
      clearTimeout(initialCheckTimeout);
      clearInterval(intervalId);
    };
  }, [tasks, sendNotification, updateTask, acceptTask]);
}
