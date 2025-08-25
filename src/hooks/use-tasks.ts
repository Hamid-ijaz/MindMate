"use client";

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { useOffline } from '@/contexts/offline-context';
import { indexedDBService } from '@/lib/indexeddb';
import { toast } from 'sonner';

export interface Task {
  id: string;
  title: string;
  description?: string;
  completed: boolean;
  priority: 'low' | 'medium' | 'high';
  category?: string;
  dueDate?: Date;
  reminder?: Date;
  tags?: string[];
  userId: string;
  createdAt: Date;
  updatedAt: Date;
  subtasks?: Subtask[];
  isLocal?: boolean;
  syncStatus?: 'synced' | 'pending' | 'failed';
}

export interface Subtask {
  id: string;
  title: string;
  completed: boolean;
  taskId: string;
}

export function useTasks() {
  const { user } = useAuth();
  const { isOnline, isServerReachable, addOfflineAction } = useOffline();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isFullyOnline = isOnline && isServerReachable;

  // Load tasks from IndexedDB or API
  const loadTasks = useCallback(async () => {
    if (!user?.email) {
      setTasks([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      if (isFullyOnline) {
        // Try to fetch from API first
        try {
          const response = await fetch('/api/tasks');
          if (response.ok) {
            const apiTasks = await response.json();
            // Update local storage
            await indexedDBService.syncTasks(user.email, apiTasks);
            setTasks(apiTasks);
            return;
          }
        } catch (apiError) {
          console.warn('API fetch failed, falling back to local data:', apiError);
        }
      }

      // Fallback to local data
      const localTasks = await indexedDBService.getTasks(user.email);
      setTasks(localTasks);

      // Remove duplicate offline mode toast since it's handled by offline-context
      // if (!isFullyOnline && localTasks.length > 0) {
      //   toast.info('Showing cached tasks (offline mode)');
      // }
    } catch (err) {
      setError('Failed to load tasks');
      console.error('Error loading tasks:', err);
    } finally {
      setLoading(false);
    }
  }, [user?.email, isFullyOnline]);

  // Create a new task
  const createTask = useCallback(async (taskData: Omit<Task, 'id' | 'userId' | 'createdAt' | 'updatedAt'>) => {
    if (!user?.email) return null;

    const newTask: Task = {
      ...taskData,
      id: `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId: user.email,
      createdAt: new Date(),
      updatedAt: new Date(),
      syncStatus: isFullyOnline ? 'synced' : 'pending',
      isLocal: !isFullyOnline
    };

    try {
      // Always save to local storage first
      await indexedDBService.createTask(user.email, newTask);
      setTasks(prev => [newTask, ...prev]);

      if (isFullyOnline) {
        // Try to sync to server
        try {
          const response = await fetch('/api/tasks', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              ...newTask,
              userEmail: user.email // Ensure correct user email
            })
          });

          if (!response.ok) {
            throw new Error('Server sync failed');
          }

          const serverTask = await response.json();
          // Update local task with server ID
          await indexedDBService.updateTask(user.email, serverTask.id, {
            ...serverTask,
            syncStatus: 'synced',
            isLocal: false
          });
          
          setTasks(prev => prev.map(t => t.id === newTask.id ? serverTask : t));
          // Single success toast for online creation
          toast.success('Task created successfully');
        } catch (syncError) {
          // Queue for offline sync
          await addOfflineAction({
            type: 'CREATE_TASK',
            data: {
              ...newTask,
              userEmail: user.email // Ensure correct user email for sync
            },
            timestamp: Date.now()
          });
          
          // Single offline toast when online sync fails
          toast.warning('Task created offline, will sync when connected');
        }
      } else {
        // Queue for offline sync
        await addOfflineAction({
          type: 'CREATE_TASK',
          data: {
            ...newTask,
            userEmail: user.email // Ensure correct user email for sync
          },
          timestamp: Date.now()
        });
        
        // Single offline toast when completely offline
        toast.success('Task created offline');
      }

      return newTask;
    } catch (err) {
      setError('Failed to create task');
      console.error('Error creating task:', err);
      return null;
    }
  }, [user?.email, isFullyOnline, addOfflineAction]);

  // Update a task
  const updateTask = useCallback(async (taskId: string, updates: Partial<Task>) => {
    if (!user?.email) return false;

    try {
      const updatedTask = {
        ...updates,
        id: taskId,
        updatedAt: new Date(),
        syncStatus: isFullyOnline ? 'synced' : 'pending'
      };

      // Update local storage first
      await indexedDBService.updateTask(user.email, taskId, updatedTask);
      setTasks(prev => prev.map(task => 
        task.id === taskId ? { ...task, ...updatedTask } : task
      ));

      if (isFullyOnline) {
        // Try to sync to server
        try {
          const response = await fetch(`/api/tasks/${taskId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updatedTask)
          });

          if (!response.ok) {
            throw new Error('Server sync failed');
          }
        } catch (syncError) {
          // Queue for offline sync
          await addOfflineAction({
            type: 'UPDATE_TASK',
            data: { id: taskId, ...updatedTask },
            timestamp: Date.now()
          });
        }
      } else {
        // Queue for offline sync
        await addOfflineAction({
          type: 'UPDATE_TASK',
          data: { id: taskId, ...updatedTask },
          timestamp: Date.now()
        });
      }

      return true;
    } catch (err) {
      setError('Failed to update task');
      console.error('Error updating task:', err);
      return false;
    }
  }, [user?.email, isFullyOnline, addOfflineAction]);

  // Delete a task
  const deleteTask = useCallback(async (taskId: string) => {
    if (!user?.email) return false;

    try {
      // Remove from local storage first
      await indexedDBService.deleteTask(user.email, taskId);
      setTasks(prev => prev.filter(task => task.id !== taskId));

      if (isFullyOnline) {
        // Try to sync to server
        try {
          const response = await fetch(`/api/tasks/${taskId}`, {
            method: 'DELETE'
          });

          if (!response.ok) {
            throw new Error('Server sync failed');
          }
        } catch (syncError) {
          // Queue for offline sync
          await addOfflineAction({
            type: 'DELETE_TASK',
            data: { id: taskId },
            timestamp: Date.now()
          });
        }
      } else {
        // Queue for offline sync
        await addOfflineAction({
          type: 'DELETE_TASK',
          data: { id: taskId },
          timestamp: Date.now()
        });
      }

      return true;
    } catch (err) {
      setError('Failed to delete task');
      console.error('Error deleting task:', err);
      return false;
    }
  }, [user?.email, isFullyOnline, addOfflineAction]);

  // Toggle task completion
  const toggleTask = useCallback(async (taskId: string) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return false;

    return updateTask(taskId, { completed: !task.completed });
  }, [tasks, updateTask]);

  // Get tasks by status
  const getTasksByStatus = useCallback((completed: boolean) => {
    return tasks.filter(task => task.completed === completed);
  }, [tasks]);

  // Get tasks by priority
  const getTasksByPriority = useCallback((priority: Task['priority']) => {
    return tasks.filter(task => task.priority === priority);
  }, [tasks]);

  // Get overdue tasks
  const getOverdueTasks = useCallback(() => {
    const now = new Date();
    return tasks.filter(task => 
      !task.completed && 
      task.dueDate && 
      new Date(task.dueDate) < now
    );
  }, [tasks]);

  // Get upcoming tasks (due within 24 hours)
  const getUpcomingTasks = useCallback(() => {
    const now = new Date();
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    
    return tasks.filter(task => 
      !task.completed && 
      task.dueDate && 
      new Date(task.dueDate) >= now &&
      new Date(task.dueDate) <= tomorrow
    );
  }, [tasks]);

  // Search tasks
  const searchTasks = useCallback((query: string) => {
    const lowercaseQuery = query.toLowerCase();
    return tasks.filter(task => 
      task.title.toLowerCase().includes(lowercaseQuery) ||
      task.description?.toLowerCase().includes(lowercaseQuery) ||
      task.tags?.some(tag => tag.toLowerCase().includes(lowercaseQuery))
    );
  }, [tasks]);

  // Load tasks on mount and when dependencies change
  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  return {
    tasks,
    loading,
    error,
    createTask,
    updateTask,
    deleteTask,
    toggleTask,
    getTasksByStatus,
    getTasksByPriority,
    getOverdueTasks,
    getUpcomingTasks,
    searchTasks,
    refreshTasks: loadTasks,
    isOffline: !isFullyOnline
  };
}
