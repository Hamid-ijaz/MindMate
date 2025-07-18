
"use client";

import { useEffect, useRef } from 'react';
import { useTasks } from '@/contexts/task-context';
import { useNotifications } from '@/contexts/notification-context';

export function useSetupNotificationHandlers() {
  const { tasks, updateTask, acceptTask } = useTasks();
  const { sendNotification } = useNotifications();
  const notifiedTaskIds = useRef(new Set<string>());

  useEffect(() => {
    const checkReminders = () => {
      const now = Date.now();
      tasks.forEach(task => {
        if (
          !task.completedAt &&
          task.reminderAt &&
          task.reminderAt <= now &&
          !notifiedTaskIds.current.has(task.id) &&
          !task.notifiedAt // Also check the persistent flag
        ) {
          sendNotification(`Reminder: ${task.title}`, {
            body: task.description || "It's time to get this done!",
            tag: task.id,
            data: { taskId: task.id },
            actions: { onComplete: acceptTask }
          });
          notifiedTaskIds.current.add(task.id);
          updateTask(task.id, { notifiedAt: now });
        }
      });
    };

    const intervalId = setInterval(checkReminders, 60 * 1000);
    checkReminders(); // Initial check

    return () => clearInterval(intervalId);
  }, [tasks, sendNotification, updateTask, acceptTask]);
}
