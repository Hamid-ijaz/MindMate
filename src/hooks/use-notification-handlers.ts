
"use client";

import { useEffect, useRef } from 'react';
import { useTasks } from '@/contexts/task-context';
import { useNotifications } from '@/contexts/notification-context';

export function useSetupNotificationHandlers() {
  const { tasks, updateTask } = useTasks();
  const { sendNotification } = useNotifications();
  
  // Use a ref to hold the latest tasks array without causing the effect to re-run.
  const tasksRef = useRef(tasks);
  useEffect(() => {
    tasksRef.current = tasks;
  }, [tasks]);

  useEffect(() => {
    const checkReminders = () => {
      const now = Date.now();
      // Access the latest tasks via the ref inside the interval.
      const currentTasks = tasksRef.current;
      
      currentTasks.forEach(task => {
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
          // This update will trigger a re-render, but it's happening
          // from an interval, not during another component's render.
          updateTask(task.id, { notifiedAt: now });
        }
      });
    };

    // Run the check immediately on mount, but deferred.
    const timeoutId = setTimeout(checkReminders, 1000);
    
    // Set up the interval to run every minute.
    const intervalId = setInterval(checkReminders, 60 * 1000);

    // Cleanup on unmount.
    return () => {
      clearTimeout(timeoutId);
      clearInterval(intervalId);
    };
    // The effect should only run ONCE on mount.
    // We remove dependencies on `tasks` and `updateTask` to prevent re-running.
    // The latest state is accessed via the ref.
  }, [sendNotification, updateTask]); 
}
