
"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import type { Task, Accomplishment, TaskCategory, TaskDuration, TimeOfDay } from '@/lib/types';
import { taskService, accomplishmentService, userSettingsService } from '@/lib/firestore';
import { useAuth } from './auth-context';
import { useToast } from '@/hooks/use-toast';

// Default values for when a user has no settings yet.
const DEFAULT_CATEGORIES: TaskCategory[] = ['Work', 'Chores', 'Writing', 'Personal', 'Study'];
const DEFAULT_DURATIONS: TaskDuration[] = [15, 30, 60, 90];

interface TaskContextType {
  tasks: Task[];
  accomplishments: Accomplishment[];
  taskCategories: TaskCategory[];
  taskDurations: TaskDuration[];
  setTaskCategories: (categories: TaskCategory[]) => void;
  setTaskDurations: (durations: TaskDuration[]) => void;
  addTask: (task: Omit<Task, 'id' | 'createdAt' | 'rejectionCount' | 'isMuted' | 'completedAt' | 'lastRejectedAt'> & { parentId?: string }) => void;
  updateTask: (id: string, updates: Partial<Omit<Task, 'id' | 'createdAt'>>) => void;
  deleteTask: (id: string) => void;
  acceptTask: (id: string) => void;
  rejectTask: (id: string) => void;
  muteTask: (id: string) => void;
  uncompleteTask: (id: string) => void;
  addAccomplishment: (content: string) => void;
  isLoading: boolean;
  isSheetOpen: boolean;
  setIsSheetOpen: (isOpen: boolean) => void;
  editingTask: Task | null;
  startEditingTask: (taskId: string) => void;
  stopEditingTask: () => void;
}

const TaskContext = createContext<TaskContextType | undefined>(undefined);

export const TaskProvider = ({ children }: { children: ReactNode }) => {
  const { user, loading: authLoading } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [accomplishments, setAccomplishments] = useState<Accomplishment[]>([]);
  const [taskCategories, setTaskCategories] = useState<TaskCategory[]>(DEFAULT_CATEGORIES);
  const [taskDurations, setTaskDurations] = useState<TaskDuration[]>(DEFAULT_DURATIONS);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  
  const editingTask = tasks.find(t => t.id === editingTaskId) || null;

  // Load user data when user changes
  useEffect(() => {
    if (!authLoading) {
      if (user?.email) {
        loadUserData();
      } else {
        // Clear data when user logs out
        setTasks([]);
        setAccomplishments([]);
        setTaskCategories(DEFAULT_CATEGORIES);
        setTaskDurations(DEFAULT_DURATIONS);
        setIsLoading(false);
      }
    }
  }, [user, authLoading]);

  const loadUserData = async () => {
    if (!user?.email) return;
    
    setIsLoading(true);
    try {
      // Load user settings
      const settings = await userSettingsService.getUserSettings(user.email);
      if (settings) {
        setTaskCategories(settings.taskCategories.length > 0 ? settings.taskCategories : DEFAULT_CATEGORIES);
        setTaskDurations(settings.taskDurations.length > 0 ? settings.taskDurations : DEFAULT_DURATIONS);
      }

      // Load tasks
      const userTasks = await taskService.getTasks(user.email);
      setTasks(userTasks);

      // Load accomplishments  
      const userAccomplishments = await accomplishmentService.getAccomplishments(user.email);
      setAccomplishments(userAccomplishments);
    } catch (error) {
      console.error('Error loading user data:', error);
      toast({
        title: "Error",
        description: "Failed to load your data. Please try refreshing the page.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

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

  const addTask = useCallback(async (taskData: Omit<Task, 'id' | 'createdAt' | 'rejectionCount' | 'isMuted' | 'completedAt' | 'lastRejectedAt'> & { parentId?: string }) => {
    if (!user?.email) return;

    const newTask: Task = {
      ...taskData,
      id: new Date().toISOString() + Math.random(),
      createdAt: Date.now(),
      rejectionCount: 0,
      isMuted: false,
    };

    try {
      const taskId = await taskService.addTask(user.email, newTask);
      setTasks(prev => [...prev, { ...newTask, id: taskId }]);
    } catch (error) {
      console.error('Error adding task:', error);
      toast({
        title: "Error",
        description: "Failed to add task. Please try again.",
        variant: "destructive",
      });
    }
  }, [user?.email, toast]);

  const updateTask = useCallback(async (id: string, updates: Partial<Omit<Task, 'id' | 'createdAt'>>) => {
    try {
      await taskService.updateTask(id, updates);
      setTasks(prev => prev.map(t => (t.id === id ? { ...t, ...updates } : t)));
    } catch (error) {
      console.error('Error updating task:', error);
      toast({
        title: "Error",
        description: "Failed to update task. Please try again.",
        variant: "destructive",
      });
    }
  }, [toast]);

  const deleteTask = useCallback(async (id: string) => {
    try {
      await taskService.deleteTask(id);
      await taskService.deleteTasksWithParentId(id);
      setTasks(prev => prev.filter(t => t.id !== id && t.parentId !== id));
    } catch (error) {
      console.error('Error deleting task:', error);
      toast({
        title: "Error",
        description: "Failed to delete task. Please try again.",
        variant: "destructive",
      });
    }
  }, [toast]);
  
  const acceptTask = useCallback(async (id: string) => {
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

    await updateTask(id, { completedAt: Date.now() });
  }, [tasks, updateTask, toast]);

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
      
      // Update parent task
      await updateTask(id, { completedAt: undefined, rejectionCount: 0, lastRejectedAt: undefined });
      
      // Update children tasks
      for (const childId of childrenIds) {
        await updateTask(childId, { completedAt: undefined, rejectionCount: 0, lastRejectedAt: undefined });
      }
      
      setTasks(prev => prev.map(t => {
        if (t.id === id || childrenIds.includes(t.id)) {
          return { ...t, completedAt: undefined, rejectionCount: 0, lastRejectedAt: undefined };
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
        tasks, accomplishments, taskCategories, taskDurations, 
        setTaskCategories: handleSetTaskCategories, 
        setTaskDurations: handleSetTaskDurations,
        addAccomplishment, addTask, updateTask, deleteTask, acceptTask, rejectTask, muteTask, uncompleteTask, 
        isLoading: isLoading || authLoading,
        isSheetOpen, setIsSheetOpen, editingTask, startEditingTask, stopEditingTask
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
