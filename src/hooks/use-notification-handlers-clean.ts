"use client";

import { useEffect, useRef, useCallback } from 'react';
import { useTasks } from '@/contexts/task-context';
import { useUnifiedNotifications } from '@/contexts/unified-notification-context';
import { useAuth } from '@/contexts/auth-context';

/**
 * Custom hook for setting up automated task reminder notifications
 * Uses the unified notification system with Firestore storage and real-time updates
 */
export function useSetupNotificationHandlers() {
  const { user } = useAuth();
  const { tasks, updateTask } = useTasks();
  const { sendInAppNotification } = useUnifiedNotifications();
  
  // Use a ref to hold the latest tasks array without causing the effect to re-run
  const tasksRef = useRef(tasks);
  const isCheckingRef = useRef(false);
  
  useEffect(() => {
    tasksRef.current = tasks;
  }, [tasks]);

  /**
   * Check for tasks with due reminders and send notifications
   * Includes comprehensive error handling and duplicate prevention
   */
  const checkReminders = useCallback(async () => {
    // Prevent overlapping checks
    if (isCheckingRef.current || !user?.email) {
      return;
    }

    isCheckingRef.current = true;
    
    try {
      const now = Date.now();
      const currentTasks = tasksRef.current;
      
      // Filter tasks that need reminders
      const tasksNeedingReminders = currentTasks.filter(task => {
        return !task.completedAt &&
          task.reminderAt &&
          task.reminderAt <= now &&
          !task.notifiedAt &&
          !task.isMuted; // Respect muted tasks
      });

      if (tasksNeedingReminders.length === 0) {
        return;
      }
      
      // Process each reminder
      for (const task of tasksNeedingReminders) {
        try {
          // Generate appropriate emoji based on priority
          const priorityEmoji = task.priority === 'High' ? '🔥' : 
                               task.priority === 'Critical' ? '💥' :
                               task.priority === 'Medium' ? '⚡' : '📋';
          
          // Create contextual notification title
          const notificationTitle = `${priorityEmoji} Reminder: ${task.title}`;
          
          // Enhanced notification body with context
          let notificationBody = task.description || "It's time to get this done!";
          
          // Add time context if available
          if (task.isTimeBlocked && task.scheduledAt) {
            const scheduledTime = new Date(task.scheduledAt).toLocaleTimeString([], { 
              hour: '2-digit', 
              minute: '2-digit' 
            });
            notificationBody += `\n⏰ Scheduled for ${scheduledTime}`;
          }
          
          // Add pomodoro context if available
          if (task.estimatedPomodoros) {
            notificationBody += `\n🍅 Estimated ${task.estimatedPomodoros} pomodoro${task.estimatedPomodoros > 1 ? 's' : ''}`;
          }

          // Prepare notification data
          const notificationData = {
            taskId: task.id,
            taskTitle: task.title,
            priority: task.priority,
            category: task.category,
            type: 'task-reminder' as const,
            metadata: {
              reminderAt: task.reminderAt,
              scheduledAt: task.scheduledAt,
              isTimeBlocked: task.isTimeBlocked,
              pomodoroSessions: task.pomodoroSessions || 0,
              estimatedPomodoros: task.estimatedPomodoros || 1,
              timeSpent: task.timeSpent || 0,
              parentId: task.parentId,
              recurrence: task.recurrence,
              timestamp: now,
              source: 'automated_reminder',
              userEmail: user.email,
            }
          };

          // Send unified notification with comprehensive metadata
          const notificationId = await sendInAppNotification(
            notificationTitle,
            notificationBody,
            notificationData
          );
          
          // Mark task as notified to prevent duplicate notifications
          // This happens regardless of notification success to prevent endless retries
          await updateTask(task.id, { notifiedAt: now });
          
        } catch (taskError) {
          console.error(`Failed to send reminder for task "${task.title}":`, taskError);
          
          // Mark as notified to prevent endless retries even on error
          try {
            await updateTask(task.id, { notifiedAt: now });
          } catch (updateError) {
            console.error('Failed to mark task as notified:', updateError);
          }
          
          // Continue with other tasks even if one fails
        }
      }
      
    } catch (error) {
      console.error('Error in checkReminders:', error);
    } finally {
      isCheckingRef.current = false;
    }
  }, [user?.email, sendInAppNotification, updateTask]);

  useEffect(() => {
    // Skip if user is not authenticated
    if (!user?.email) {
      return;
    }

    // Initial check
    checkReminders();

    // Set up interval to check every minute for due reminders
    const interval = setInterval(checkReminders, 60000); // 1 minute interval

    return () => {
      clearInterval(interval);
    };
  }, [user?.email, checkReminders]);

  return { checkReminders };
}
