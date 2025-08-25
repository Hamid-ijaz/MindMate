'use client';

import { useState, useCallback } from 'react';
import { useOffline, useOfflineCapable } from '@/contexts/offline-context';
import { indexedDBService } from '@/lib/indexeddb';
import { useAuth } from '@/contexts/auth-context';
import { useToast } from '@/hooks/use-toast';
import { Task } from '@/lib/types';

export function useOfflineTasks() {
  const { user } = useAuth();
  const { isOnline, isServerReachable, addOfflineAction } = useOffline();
  const executeOfflineCapable = useOfflineCapable();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const isFullyOnline = isOnline && isServerReachable;

  // Create task (offline-capable)
  const createTask = useCallback(async (taskData: Omit<Task, 'id' | 'createdAt'>) => {
    if (!user?.email) throw new Error('User not authenticated');

    setIsLoading(true);
    try {
      const task = {
        ...taskData,
        id: `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        userEmail: user.email,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      if (isFullyOnline) {
        // Try online first
        try {
          const response = await fetch('/api/tasks', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(task),
          });

          if (response.ok) {
            const result = await response.json();
            // Store in IndexedDB for offline access
            await indexedDBService.saveTask(user.email, result.task || task, true);
            return result.task || task;
          }
        } catch (error) {
          console.warn('Online task creation failed, falling back to offline:', error);
        }
      }

      // Store offline
      await indexedDBService.saveTask(user.email, task, false);
      addOfflineAction({
        type: 'CREATE_TASK',
        data: task,
        userEmail: user.email,
      });

      toast({
        title: "Task created offline",
        description: "Your task will sync when you're back online.",
      });

      return task;
    } finally {
      setIsLoading(false);
    }
  }, [user?.email, isFullyOnline, addOfflineAction, toast]);

  // Update task (offline-capable)
  const updateTask = useCallback(async (taskId: string, updates: Partial<Task>) => {
    if (!user?.email) throw new Error('User not authenticated');

    setIsLoading(true);
    try {
      const updatedTask = {
        ...updates,
        id: taskId,
        userEmail: user.email,
        updatedAt: Date.now(),
      };

      if (isFullyOnline) {
        // Try online first
        try {
          const response = await fetch(`/api/tasks/${taskId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updatedTask),
          });

          if (response.ok) {
            const result = await response.json();
            // Update in IndexedDB
            await indexedDBService.saveTask(user.email, result.task || updatedTask, true);
            return result.task || updatedTask;
          }
        } catch (error) {
          console.warn('Online task update failed, falling back to offline:', error);
        }
      }

      // Store offline
      await indexedDBService.saveTask(user.email, updatedTask, false);
      addOfflineAction({
        type: 'UPDATE_TASK',
        data: updatedTask,
        userEmail: user.email,
      });

      toast({
        title: "Task updated offline",
        description: "Your changes will sync when you're back online.",
      });

      return updatedTask;
    } finally {
      setIsLoading(false);
    }
  }, [user?.email, isFullyOnline, addOfflineAction, toast]);

  // Delete task (offline-capable)
  const deleteTask = useCallback(async (taskId: string) => {
    if (!user?.email) throw new Error('User not authenticated');

    setIsLoading(true);
    try {
      if (isFullyOnline) {
        // Try online first
        try {
          const response = await fetch(`/api/tasks/${taskId}`, {
            method: 'DELETE',
          });

          if (response.ok) {
            await indexedDBService.deleteTask(taskId);
            return true;
          }
        } catch (error) {
          console.warn('Online task deletion failed, falling back to offline:', error);
        }
      }

      // Mark for deletion offline
      await indexedDBService.deleteTask(taskId);
      addOfflineAction({
        type: 'DELETE_TASK',
        data: { id: taskId },
        userEmail: user.email,
      });

      toast({
        title: "Task deleted offline",
        description: "The deletion will sync when you're back online.",
      });

      return true;
    } finally {
      setIsLoading(false);
    }
  }, [user?.email, isFullyOnline, addOfflineAction, toast]);

  // Get tasks (offline-first)
  const getTasks = useCallback(async (): Promise<Task[]> => {
    if (!user?.email) return [];

    try {
      if (isFullyOnline) {
        // Try to fetch from server and update cache
        try {
          const response = await fetch('/api/tasks');
          if (response.ok) {
            const data = await response.json();
            const tasks = data.tasks || [];
            // Cache in IndexedDB
            await indexedDBService.saveTasks(user.email, tasks);
            return tasks;
          }
        } catch (error) {
          console.warn('Failed to fetch tasks online, using offline cache:', error);
        }
      }

      // Fallback to offline cache
      const offlineTasks = await indexedDBService.getTasks(user.email);
      return offlineTasks;
    } catch (error) {
      console.error('Failed to get tasks:', error);
      return [];
    }
  }, [user?.email, isFullyOnline]);

  // Complete task with offline support
  const completeTask = useCallback(async (taskId: string) => {
    return updateTask(taskId, {
      completed: true,
      completedAt: Date.now(),
    });
  }, [updateTask]);

  // Uncomplete task with offline support
  const uncompleteTask = useCallback(async (taskId: string) => {
    return updateTask(taskId, {
      completed: false,
      completedAt: undefined,
    });
  }, [updateTask]);

  return {
    createTask,
    updateTask,
    deleteTask,
    getTasks,
    completeTask,
    uncompleteTask,
    isLoading,
    isOffline: !isFullyOnline,
  };
}

export function useOfflineNotes() {
  const { user } = useAuth();
  const { isOnline, isServerReachable, addOfflineAction } = useOffline();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const isFullyOnline = isOnline && isServerReachable;

  // Create note (offline-capable)
  const createNote = useCallback(async (noteData: any) => {
    if (!user?.email) throw new Error('User not authenticated');

    setIsLoading(true);
    try {
      const note = {
        ...noteData,
        id: `note_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        userEmail: user.email,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      if (isFullyOnline) {
        // Try online first
        try {
          const response = await fetch('/api/notes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(note),
          });

          if (response.ok) {
            const result = await response.json();
            // Store in IndexedDB for offline access
            await indexedDBService.saveNote(user.email, result.note || note, true);
            return result.note || note;
          }
        } catch (error) {
          console.warn('Online note creation failed, falling back to offline:', error);
        }
      }

      // Store offline
      await indexedDBService.saveNote(user.email, note, false);
      addOfflineAction({
        type: 'CREATE_NOTE',
        data: note,
        userEmail: user.email,
      });

      toast({
        title: "Note created offline",
        description: "Your note will sync when you're back online.",
      });

      return note;
    } finally {
      setIsLoading(false);
    }
  }, [user?.email, isFullyOnline, addOfflineAction, toast]);

  // Update note (offline-capable)
  const updateNote = useCallback(async (noteId: string, updates: any) => {
    if (!user?.email) throw new Error('User not authenticated');

    setIsLoading(true);
    try {
      const updatedNote = {
        ...updates,
        id: noteId,
        userEmail: user.email,
        updatedAt: Date.now(),
      };

      if (isFullyOnline) {
        // Try online first
        try {
          const response = await fetch(`/api/notes/${noteId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updatedNote),
          });

          if (response.ok) {
            const result = await response.json();
            // Update in IndexedDB
            await indexedDBService.saveNote(user.email, result.note || updatedNote, true);
            return result.note || updatedNote;
          }
        } catch (error) {
          console.warn('Online note update failed, falling back to offline:', error);
        }
      }

      // Store offline
      await indexedDBService.saveNote(user.email, updatedNote, false);
      addOfflineAction({
        type: 'UPDATE_NOTE',
        data: updatedNote,
        userEmail: user.email,
      });

      toast({
        title: "Note updated offline",
        description: "Your changes will sync when you're back online.",
      });

      return updatedNote;
    } finally {
      setIsLoading(false);
    }
  }, [user?.email, isFullyOnline, addOfflineAction, toast]);

  // Delete note (offline-capable)
  const deleteNote = useCallback(async (noteId: string) => {
    if (!user?.email) throw new Error('User not authenticated');

    setIsLoading(true);
    try {
      if (isFullyOnline) {
        // Try online first
        try {
          const response = await fetch(`/api/notes/${noteId}`, {
            method: 'DELETE',
          });

          if (response.ok) {
            await indexedDBService.deleteNote(noteId);
            return true;
          }
        } catch (error) {
          console.warn('Online note deletion failed, falling back to offline:', error);
        }
      }

      // Mark for deletion offline
      await indexedDBService.deleteNote(noteId);
      addOfflineAction({
        type: 'DELETE_NOTE',
        data: { id: noteId },
        userEmail: user.email,
      });

      toast({
        title: "Note deleted offline",
        description: "The deletion will sync when you're back online.",
      });

      return true;
    } finally {
      setIsLoading(false);
    }
  }, [user?.email, isFullyOnline, addOfflineAction, toast]);

  // Get notes (offline-first)
  const getNotes = useCallback(async () => {
    if (!user?.email) return [];

    try {
      if (isFullyOnline) {
        // Try to fetch from server and update cache
        try {
          const response = await fetch('/api/notes');
          if (response.ok) {
            const data = await response.json();
            const notes = data.notes || [];
            // Cache in IndexedDB
            await indexedDBService.saveNotes(user.email, notes);
            return notes;
          }
        } catch (error) {
          console.warn('Failed to fetch notes online, using offline cache:', error);
        }
      }

      // Fallback to offline cache
      const offlineNotes = await indexedDBService.getNotes(user.email);
      return offlineNotes;
    } catch (error) {
      console.error('Failed to get notes:', error);
      return [];
    }
  }, [user?.email, isFullyOnline]);

  return {
    createNote,
    updateNote,
    deleteNote,
    getNotes,
    isLoading,
    isOffline: !isFullyOnline,
  };
}
