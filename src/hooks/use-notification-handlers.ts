
"use client";

import { useEffect, useRef } from 'react';
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
          !task.notifiedAt // Rely solely on the persistent flag from the database
        ) {
          sendNotification(`Reminder: ${task.title}`, {
            body: task.description || "It's time to get this done!",
            tag: task.id,
            data: { taskId: task.id },
            actions: { onComplete: acceptTask }
          });
          // Update the task in the database to mark it as notified
          updateTask(task.id, { notifiedAt: now });
        }
      });
    };

    const intervalId = setInterval(checkReminders, 60 * 1000);
    checkReminders(); // Initial check on app load

    return () => clearInterval(intervalId);
  }, [tasks, sendNotification, updateTask, acceptTask]);
}
