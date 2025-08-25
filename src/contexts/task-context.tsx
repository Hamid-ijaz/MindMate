"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode, useRef } from 'react';
import type { Task, Accomplishment, TaskCategory, TaskDuration, TimeOfDay, Note } from '@/lib/types';
import { taskService, accomplishmentService, userSettingsService } from '@/lib/firestore';
import { useAuth } from './auth-context';
import { useToast } from '@/hooks/use-toast';
import { useNotifications } from './notification-context';
import { usePushNotificationHelper } from '@/hooks/use-push-notification-helper';
import { useOffline } from './offline-context';
import { indexedDBService } from '@/lib/indexeddb';
import { addDays, addMonths, addWeeks } from 'date-fns';

// Default values for when a user has no settings yet.
const DEFAULT_CATEGORIES: TaskCategory[] = ['Work', 'Chores', 'Writing', 'Personal', 'Study'];
const DEFAULT_DURATIONS: TaskDuration[] = [15, 30, 60, 90];

interface TaskContextType {
  tasks: Task[];
  notes: Note[];
  accomplishments: Accomplishment[];
  taskCategories: TaskCategory[];
  taskDurations: TaskDuration[];
  setTaskCategories: (categories: TaskCategory[]) => Promise<void>;
  setTaskDurations: (durations: TaskDuration[]) => Promise<void>;
  addTask: (task: Omit<Task, 'id' | 'createdAt' | 'rejectionCount' | 'isMuted' | 'completedAt' | 'lastRejectedAt' | 'notifiedAt'> & { parentId?: string }) => Promise<void>;
  updateTask: (id: string, updates: Partial<Omit<Task, 'id' | 'createdAt'>>) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
  acceptTask: (id: string, options?: { showNotification?: boolean; onComplete?: () => void }) => Promise<void>;
  rejectTask: (id: string) => Promise<void>;
  muteTask: (id: string) => Promise<void>;
  uncompleteTask: (id: string) => Promise<void>;
  addAccomplishment: (content: string) => Promise<void>;
  isLoading: boolean;
  isSheetOpen: boolean;
  setIsSheetOpen: (isOpen: boolean) => void;
  editingTask: Task | null;
  startEditingTask: (taskId: string) => void;
  stopEditingTask: () => void;
  preFilledData: Partial<Task> | null;
  setPreFilledData: (data: Partial<Task> | null) => void;
}

const TaskContext = createContext<TaskContextType | undefined>(undefined);

export const TaskProvider = ({ children }: { children: ReactNode }) => {
  const { user, loading: authLoading } = useAuth();
  const { isOnline, isServerReachable, addOfflineAction } = useOffline();
  const { toast } = useToast();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [accomplishments, setAccomplishments] = useState<Accomplishment[]>([]);
  const [taskCategories, setTaskCategories] = useState<TaskCategory[]>(DEFAULT_CATEGORIES);
  const [taskDurations, setTaskDurations] = useState<TaskDuration[]>(DEFAULT_DURATIONS);
  const [isLoading, setIsLoading] = useState(true);
  
  // Use notification context safely - it will provide defaults during SSR
  const { sendNotification } = useNotifications();
  const pushNotifications = usePushNotificationHelper();


  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [preFilledData, setPreFilledData] = useState<Partial<Task> | null>(null);
  
  const editingTask = tasks.find(t => t.id === editingTaskId) || null;

  // Load user data when user changes
  useEffect(() => {
    console.log('🎯 TaskContext useEffect triggered - authLoading:', authLoading, 'user:', user?.email);
    if (!authLoading) {
      if (user?.email) {
        console.log('✅ User authenticated, loading data...');
        loadUserData();
      } else {
        console.log('🚪 No user, clearing data...');
        // Clear data when user logs out
        setTasks([]);
        setAccomplishments([]);
        setTaskCategories(DEFAULT_CATEGORIES);
        setTaskDurations(DEFAULT_DURATIONS);
        setIsLoading(false);
      }
    }
  }, [user, authLoading, isOnline, isServerReachable]);

  const loadUserData = useCallback(async () => {
    if (!user?.email) return;
    
    console.log('🔄 loadUserData called for user:', user.email);
    setIsLoading(true);
    const isFullyOnline = isOnline && isServerReachable;
    console.log('🌐 Connection status - Online:', isOnline, 'Server reachable:', isServerReachable, 'Fully online:', isFullyOnline);
    
    try {
      // Ensure IndexedDB is properly initialized before proceeding
      await indexedDBService.init();
      console.log('✅ IndexedDB initialized successfully');
      
      if (isFullyOnline) {
        try {
          console.log('📡 Attempting to load from server...');
          // Try to load from server first when online
          const [settings, userTasks, userAccomplishments] = await Promise.all([
            userSettingsService.getUserSettings(user.email),
            taskService.getTasks(user.email),
            accomplishmentService.getAccomplishments(user.email)
          ]);

          console.log('📊 Server data loaded - Tasks:', userTasks.length, 'Accomplishments:', userAccomplishments.length);

          // Update settings
          if (settings) {
            setTaskCategories(settings.taskCategories.length > 0 ? settings.taskCategories : DEFAULT_CATEGORIES);
            setTaskDurations(settings.taskDurations.length > 0 ? settings.taskDurations : DEFAULT_DURATIONS);
          }

          // Update tasks and cache them
          setTasks(userTasks);
          await indexedDBService.syncTasks(user.email, userTasks);
          console.log('💾 Tasks synced to IndexedDB');
          
          // Update accomplishments
          setAccomplishments(userAccomplishments);
          
          return; // Success, we're done
        } catch (serverError) {
          console.warn('⚠️ Failed to load from server, falling back to offline cache:', serverError);
        }
      }

      // Fallback to offline cache (either offline or server failed)
      console.log('📱 Loading from offline cache...');
      const [cachedTasks, cachedSettings] = await Promise.all([
        indexedDBService.getTasks(user.email),
        userSettingsService.getUserSettings(user.email).catch(() => null)
      ]);

      console.log('💾 Cached data loaded - Tasks:', cachedTasks.length);

      // Load cached tasks
      setTasks(cachedTasks);
      
      // Load settings (offline doesn't have cached settings, so use defaults if server fails)
      if (cachedSettings) {
        setTaskCategories(cachedSettings.taskCategories.length > 0 ? cachedSettings.taskCategories : DEFAULT_CATEGORIES);
        setTaskDurations(cachedSettings.taskDurations.length > 0 ? cachedSettings.taskDurations : DEFAULT_DURATIONS);
      }

      // Remove the duplicate offline mode toast since it's handled by offline-context
      // if (!isFullyOnline && cachedTasks.length > 0) {
      //   toast({
      //     title: "Offline Mode",
      //     description: "Showing cached data (offline mode)",
      //   });
      // }
      
    } catch (error) {
      console.error('❌ Error loading user data:', error);
      toast({
        title: "Error",
        description: "Failed to load your data. Please try refreshing the page.",
        variant: "destructive",
      });
    } finally {
      console.log('🏁 loadUserData completed');
      setIsLoading(false);
    }
  }, [user?.email, isOnline, isServerReachable]); // Add dependencies for useCallback

  // Listen for sync completion to refresh data
  useEffect(() => {
    const handleSyncCompleted = (event: CustomEvent) => {
      console.log('📡 Sync completed event received, refreshing task data...');
      if (user?.email) {
        loadUserData();
      }
    };

    window.addEventListener('offline-sync-completed', handleSyncCompleted as EventListener);
    return () => {
      window.removeEventListener('offline-sync-completed', handleSyncCompleted as EventListener);
    };
  }, [user?.email, loadUserData]);

  const handleSetTaskCategories = useCallback(async (categories: TaskCategory[]) => {
    setTaskCategories(categories);
    if (user?.email) {
      try {
        await userSettingsService.updateUserSettings(user.email, { taskCategories: categories });
      } catch (error) {
        console.error('Error saving task categories:', error);
      }
    }
  }, [user?.email]);

  const handleSetTaskDurations = useCallback(async (durations: TaskDuration[]) => {
    setTaskDurations(durations);
    if (user?.email) {
      try {
        await userSettingsService.updateUserSettings(user.email, { taskDurations: durations });
      } catch (error) {
        console.error('Error saving task durations:', error);
      }
    }
  }, [user?.email]);

  const addTask = useCallback(async (taskData: Omit<Task, 'id' | 'createdAt' | 'rejectionCount' | 'isMuted' | 'completedAt' | 'lastRejectedAt' | 'notifiedAt'> & { parentId?: string }) => {
    if (!user?.email) return;

    const isFullyOnline = isOnline && isServerReachable;
    
    try {
      // Ensure IndexedDB is properly initialized before proceeding
      await indexedDBService.init();
    } catch (error) {
      console.error('Failed to initialize IndexedDB:', error);
      toast({
        title: "Storage Error",
        description: "Failed to initialize local storage. Please refresh the page.",
        variant: "destructive",
      });
      return;
    }
    
    const bulletRegex = /(^|\n)\s*[-*+]\s+(.*)/g;
    const description = taskData.description || '';
    const hasBullets = bulletRegex.test(description);
    
    let subtasksToCreate: Omit<Task, 'id' | 'createdAt' | 'rejectionCount' | 'isMuted'>[] = [];
    let parentDescription = description;

    if (hasBullets && !taskData.parentId) { // Only process bullets for new parent tasks
      const lines = description.split('\n');
      const bullets: string[] = [];
      const remainingLines: string[] = [];

      lines.forEach(line => {
        const match = /^\s*[-*+]\s+(.*)/.exec(line);
        if (match) {
          bullets.push(match[1]);
        } else {
          remainingLines.push(line);
        }
      });
      
      parentDescription = remainingLines.join('\n').trim();

      subtasksToCreate = bullets.map(title => ({
        title: title.trim(),
        description: '', // Subtasks from bullets have no description initially
        category: taskData.category,
        priority: 'Low', // Default to low priority
        duration: 15, // Default to 15 mins
        timeOfDay: taskData.timeOfDay,
        userEmail: user.email, // Add missing userEmail
      }));
    }

    const parentTaskData: Omit<Task, 'id' | 'createdAt'> = {
        ...taskData,
        description: parentDescription,
        rejectionCount: 0,
        isMuted: false,
    };

    // Generate local IDs for immediate UI update
    const now = Date.now();
    const parentId = `task_${now}_${Math.random().toString(36).substr(2, 9)}`;
    const parentTask: Task = {
      ...parentTaskData,
      id: parentId,
      createdAt: now,
      syncStatus: isFullyOnline ? 'synced' : 'pending',
      isLocal: !isFullyOnline
    } as Task;

    // Optimistically update UI immediately
    setTasks(prev => [parentTask, ...prev]);
    
    try {
      // Always save to IndexedDB first for immediate persistence
      await indexedDBService.createTask(user.email, parentTask);
      
      if (isFullyOnline) {
        try {
          // Use the batch addTask service
          const { parentId: serverId, childIds } = await taskService.addTaskWithSubtasks(user.email, parentTaskData, subtasksToCreate);
          
          // Update the task with server ID
          const serverTask = { ...parentTask, id: serverId, syncStatus: 'synced', isLocal: false };
          await indexedDBService.updateTask(user.email, parentId, serverTask);
          setTasks(prev => prev.map(t => t.id === parentId ? serverTask : t));
          
          // Schedule push notification reminder if reminder time is set
          if (serverTask.reminderAt) {
            await pushNotifications.scheduleTaskReminder(serverTask);
          }
          
          // Handle subtasks
          if (subtasksToCreate.length > 0) {
            const newSubtasks = subtasksToCreate.map((sub, index) => ({
              ...sub,
              id: childIds[index],
              parentId: serverId,
              rejectionCount: 0,
              isMuted: false,
              createdAt: now + index + 1,
              syncStatus: 'synced',
              isLocal: false
            }));
            
            setTasks(prev => [...prev, ...newSubtasks as Task[]]);
            
            // Save subtasks to IndexedDB
            for (const subtask of newSubtasks) {
              await indexedDBService.createTask(user.email, subtask as Task);
              if (subtask.reminderAt) {
                await pushNotifications.scheduleTaskReminder(subtask as Task);
              }
            }
            
            toast({
              title: "Task and Subtasks Added!",
              description: `${subtasksToCreate.length} subtasks were created from your description.`
            });
          } else {
            toast({
              title: "Task Added!",
              description: "Your task has been created successfully."
            });
          }
        } catch (syncError) {
          console.warn('Failed to sync to server, keeping local copy:', syncError);
          // Queue for offline sync
          await addOfflineAction({
            type: 'CREATE_TASK',
            data: parentTask,
            timestamp: Date.now()
          });
          
          toast({
            title: "Task Created Offline",
            description: "Task created offline, will sync when connected",
            variant: "default",
          });
        }
      } else {
        // Queue for offline sync
        await addOfflineAction({
          type: 'CREATE_TASK',
          data: parentTask,
          timestamp: Date.now()
        });
        
        toast({
          title: "Task Created",
          description: "Task created offline",
        });
        
        // Schedule local notification if reminder time is set
        if (parentTask.reminderAt) {
          await pushNotifications.scheduleTaskReminder(parentTask);
        }
      }

    } catch (error) {
      console.error('Error adding task:', error);
      // Remove from UI if there was an error
      setTasks(prev => prev.filter(t => t.id !== parentId));
      
      toast({
        title: "Error",
        description: "Failed to add task. Please try again.",
        variant: "destructive",
      });
    }
  }, [user?.email, toast, isOnline, isServerReachable, addOfflineAction, pushNotifications]);

  const updateTask = useCallback(async (id: string, updates: Partial<Omit<Task, 'id' | 'createdAt'>>) => {
    if (!user?.email) return;

    const isFullyOnline = isOnline && isServerReachable;
    
    try {
      // Ensure IndexedDB is properly initialized before proceeding
      await indexedDBService.init();
    } catch (error) {
      console.error('Failed to initialize IndexedDB:', error);
      toast({
        title: "Storage Error",
        description: "Failed to initialize local storage. Please refresh the page.",
        variant: "destructive",
      });
      return;
    }
    
    // Create the updated task data
    const updatedData = {
      ...updates,
      updatedAt: new Date(),
      syncStatus: isFullyOnline ? 'synced' : 'pending'
    };

    // Optimistically update UI immediately
    setTasks(prev => prev.map(t => (t.id === id ? { ...t, ...updatedData } as Task : t)));

    try {
      // Always update IndexedDB first for immediate persistence
      await indexedDBService.updateTask(user.email, id, updatedData);
      
      if (isFullyOnline) {
        try {
          // Try to sync to server
          await taskService.updateTask(id, updates);
          
          // Update sync status on success
          const syncedData = { ...updatedData, syncStatus: 'synced', isLocal: false };
          await indexedDBService.updateTask(user.email, id, syncedData);
          setTasks(prev => prev.map(t => (t.id === id ? { ...t, ...syncedData } as Task : t)));
          
        } catch (syncError) {
          console.warn('Failed to sync update to server:', syncError);
          // Queue for offline sync
          await addOfflineAction({
            type: 'UPDATE_TASK',
            data: { id, ...updatedData },
            timestamp: Date.now()
          });
          
          // Update sync status to pending
          const pendingData = { ...updatedData, syncStatus: 'pending' };
          await indexedDBService.updateTask(user.email, id, pendingData);
          setTasks(prev => prev.map(t => (t.id === id ? { ...t, ...pendingData } as Task : t)));
        }
      } else {
        // Queue for offline sync
        await addOfflineAction({
          type: 'UPDATE_TASK',
          data: { id, ...updatedData },
          timestamp: Date.now()
        });
        
        toast({
          title: "Task Updated",
          description: "Task updated offline, will sync when connected",
        });
      }
      
    } catch (error) {
      console.error('Error updating task:', error);
      // Revert UI change on error
      setTasks(prev => prev.map(t => {
        if (t.id === id) {
          const { ...originalTask } = t;
          delete (originalTask as any).updatedAt;
          delete (originalTask as any).syncStatus;
          return originalTask;
        }
        return t;
      }));
      
      toast({
        title: "Error",
        description: "Failed to update task. Please try again.",
        variant: "destructive",
      });
    }
  }, [user?.email, toast, isOnline, isServerReachable, addOfflineAction]);

  const deleteTask = useCallback(async (id: string) => {
    if (!user?.email) return;

    const isFullyOnline = isOnline && isServerReachable;
    
    try {
      // Ensure IndexedDB is properly initialized before proceeding
      await indexedDBService.init();
    } catch (error) {
      console.error('Failed to initialize IndexedDB:', error);
      toast({
        title: "Storage Error",
        description: "Failed to initialize local storage. Please refresh the page.",
        variant: "destructive",
      });
      return;
    }
    
    // Store the original tasks for potential rollback
    const taskToDelete = tasks.find(t => t.id === id);
    const childTasks = tasks.filter(t => t.parentId === id);
    
    // Optimistically update UI immediately
    setTasks(prev => prev.filter(t => t.id !== id && t.parentId !== id));

    try {
      // Always remove from IndexedDB first
      await indexedDBService.deleteTask(user.email, id);
      
      // Delete child tasks from IndexedDB
      for (const child of childTasks) {
        await indexedDBService.deleteTask(user.email, child.id);
      }
      
      if (isFullyOnline) {
        try {
          // Try to sync deletion to server
          await taskService.deleteTask(id);
          await taskService.deleteTasksWithParentId(id);
          
        } catch (syncError) {
          console.warn('Failed to sync deletion to server:', syncError);
          // Queue for offline sync
          await addOfflineAction({
            type: 'DELETE_TASK',
            data: { id },
            timestamp: Date.now()
          });
          
          // Queue child deletions too
          for (const child of childTasks) {
            await addOfflineAction({
              type: 'DELETE_TASK',
              data: { id: child.id },
              timestamp: Date.now()
            });
          }
        }
      } else {
        // Queue for offline sync
        await addOfflineAction({
          type: 'DELETE_TASK',
          data: { id },
          timestamp: Date.now()
        });
        
        // Queue child deletions too
        for (const child of childTasks) {
          await addOfflineAction({
            type: 'DELETE_TASK',
            data: { id: child.id },
            timestamp: Date.now()
          });
        }
        
        toast({
          title: "Task Deleted",
          description: "Task deleted offline, will sync when connected",
        });
      }
      
    } catch (error) {
      console.error('Error deleting task:', error);
      
      // Rollback UI changes on error
      if (taskToDelete) {
        setTasks(prev => [...prev, taskToDelete, ...childTasks]);
      }
      
      toast({
        title: "Error",
        description: "Failed to delete task. Please try again.",
        variant: "destructive",
      });
    }
  }, [user?.email, tasks, toast, isOnline, isServerReachable, addOfflineAction]);
  
  const acceptTask = useCallback(async (id: string, options?: { showNotification?: boolean; onComplete?: () => void }) => {
    const task = tasks.find(t => t.id === id);
    if (!task || !user?.email) return;

    const subtasks = tasks.filter(t => t.parentId === id);
    const pendingSubtasks = subtasks.filter(t => !t.completedAt);

    if (pendingSubtasks.length > 0) {
      toast({
        title: "Cannot Complete Task",
        description: "Please complete all sub-tasks before marking the parent task as done.",
        variant: "destructive",
      });
      return;
    }
    
    // Handle recurrence
    if (task.recurrence && task.recurrence.frequency !== 'none') {
        const now = new Date();
        if (task.recurrence.endDate && now.getTime() > task.recurrence.endDate) {
                    // End date is passed, just complete the task without rescheduling
         await updateTask(id, { completedAt: Date.now() });
         options?.onComplete?.();
         return;
        }

        const reminderDate = task.reminderAt ? new Date(task.reminderAt) : new Date();
        let nextReminderDate;

        switch (task.recurrence.frequency) {
            case 'daily':
                nextReminderDate = addDays(reminderDate, 1);
                break;
            case 'weekly':
                nextReminderDate = addWeeks(reminderDate, 1);
                break;
            case 'monthly':
                nextReminderDate = addMonths(reminderDate, 1);
                break;
            default:
                nextReminderDate = reminderDate;
        }
        
        // If next date is past the end date, complete without rescheduling
        if (task.recurrence.endDate && nextReminderDate.getTime() > task.recurrence.endDate) {
            await updateTask(id, { completedAt: Date.now() });
            options?.onComplete?.();
            return;
        }

        // Create the new recurring task
        const newTaskData = {
            ...task,
            reminderAt: nextReminderDate.getTime(),
            completedAt: undefined,
            notifiedAt: undefined,
            rejectionCount: 0,
            lastRejectedAt: undefined,
        };
        // Omit fields that should not be copied
        delete (newTaskData as Partial<Task>).id;
        delete (newTaskData as Partial<Task>).completedAt;
        
        // Batch operation: complete old task, add new one
        await taskService.completeAndReschedule(task.id, user.email, newTaskData);

        // UI update
        setTasks(prev => {
            const completed = prev.map(t => t.id === id ? { ...t, completedAt: Date.now() } as Task : t);
            // In a real scenario, we'd get the new ID back from the service, but for now we'll just optimistically add.
            // A better way would be for completeAndReschedule to return the new task.
            // For now, let's just refetch to get the latest data. This is simpler but less performant.
            loadUserData();
            return completed;
        });
        
        options?.onComplete?.();

    } else {
        // Not a recurring task
        await updateTask(id, { completedAt: Date.now() });
        options?.onComplete?.();
    }
  }, [tasks, updateTask, toast, user?.email]);

  const rejectTask = useCallback(async (id: string) => {
    const task = tasks.find(t => t.id === id);
    if (task) {
      await updateTask(id, {
        rejectionCount: (task.rejectionCount || 0) + 1,
        lastRejectedAt: Date.now(),
      });
    }
  }, [tasks, updateTask]);

  const muteTask = useCallback(async (id: string) => {
    await updateTask(id, { isMuted: true });
  }, [updateTask]);

  const uncompleteTask = useCallback(async (id: string) => {
    const task = tasks.find(t => t.id === id);
    if (task) {
      const childrenIds = tasks.filter(t => t.parentId === id).map(t => t.id);
      const updates = { 
        completedAt: null, 
        lastRejectedAt: null,
        notifiedAt: null,
        rejectionCount: 0,
      };

      // Update parent task
      await updateTask(id, updates);
      
      // Update children tasks
      for (const childId of childrenIds) {
        await updateTask(childId, updates);
      }
      
      setTasks(prev => prev.map(t => {
        if (t.id === id || childrenIds.includes(t.id)) {
          // Casting to any to bypass strict type check for null assignment
          return { ...t, ...updates as any };
        }
        return t;
      }));
    }
  }, [tasks, updateTask]);


  const addAccomplishment = useCallback(async (content: string) => {
    if (!user?.email) return;

    const newAccomplishment: Accomplishment = {
      id: new Date().toISOString() + Math.random(),
      date: new Date().toISOString().split('T')[0],
      content,
    };

    try {
      const accomplishmentId = await accomplishmentService.addAccomplishment(user.email, newAccomplishment);
      setAccomplishments(prev => [...prev, { ...newAccomplishment, id: accomplishmentId }]);
    } catch (error) {
      console.error('Error adding accomplishment:', error);
      toast({
        title: "Error",
        description: "Failed to add accomplishment. Please try again.",
        variant: "destructive",
      });
    }
  }, [user?.email, toast]);

  const startEditingTask = useCallback((taskId: string) => {
    setEditingTaskId(taskId);
    setIsSheetOpen(true);
  }, []);

  const stopEditingTask = useCallback(() => {
    setEditingTaskId(null);
  }, []);
  
  return (
    <TaskContext.Provider value={{ 
        tasks, notes, accomplishments, taskCategories, taskDurations, 
        setTaskCategories: handleSetTaskCategories, 
        setTaskDurations: handleSetTaskDurations,
        addAccomplishment, addTask, updateTask, deleteTask, acceptTask, rejectTask, muteTask, uncompleteTask, 
        isLoading: isLoading || authLoading,
        isSheetOpen, setIsSheetOpen, editingTask, startEditingTask, stopEditingTask,
        preFilledData, setPreFilledData
    }}>
      {children}
    </TaskContext.Provider>
  );
};

export const useTasks = (): TaskContextType => {
  const context = useContext(TaskContext);
  if (context === undefined) {
    throw new Error('useTasks must be used within a TaskProvider');
  }
  return context;
};
