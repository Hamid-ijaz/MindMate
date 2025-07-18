
"use client";

import { useEffect } from 'react';
import { useTasks } from '@/contexts/task-context';
import { useNotifications } from '@/contexts/notification-context';

export function useSetupNotificationHandlers() {
  const { tasks, updateTask } = useTasks();
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
          });
          updateTask(task.id, { notifiedAt: now });
        }
      });
    };

    // Defer the check to run after the current render cycle completes.
    // This prevents the "cannot update a component while rendering another" error.
    const timeoutId = setTimeout(checkReminders, 0);

    const intervalId = setInterval(checkReminders, 60 * 1000);

    return () => {
      clearTimeout(timeoutId);
      clearInterval(intervalId);
    };
  }, [tasks, sendNotification, updateTask]);
}
