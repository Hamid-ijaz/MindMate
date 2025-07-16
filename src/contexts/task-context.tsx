
"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import type { Task, Accomplishment } from '@/lib/types';
import { LOCAL_STORAGE_KEY } from '@/lib/constants';
import { useAuth } from './auth-context';
import { useToast } from '@/hooks/use-toast';

interface TaskContextType {
  tasks: Task[];
  accomplishments: Accomplishment[];
  addTask: (task: Omit<Task, 'id' | 'createdAt' | 'rejectionCount' | 'isMuted' | 'completedAt' | 'lastRejectedAt'> & { parentId?: string }) => void;
  updateTask: (id: string, updates: Partial<Omit<Task, 'id' | 'createdAt'>>) => void;
  deleteTask: (id: string) => void;
  acceptTask: (id: string) => void;
  rejectTask: (id: string) => void;
  muteTask: (id: string) => void;
  uncompleteTask: (id: string) => void;
  addAccomplishment: (content: string) => void;
  isLoading: boolean;
}

const TaskContext = createContext<TaskContextType | undefined>(undefined);

const getInitialState = (userEmail: string | null): { tasks: Task[], accomplishments: Accomplishment[] } => {
  if (typeof window === 'undefined' || !userEmail) {
    return { tasks: [], accomplishments: [] };
  }
  try {
    const key = `${LOCAL_STORAGE_KEY}-${userEmail}`;
    const item = window.localStorage.getItem(key);
    const parsed = item ? JSON.parse(item) : {};
    return { tasks: parsed.tasks || [], accomplishments: parsed.accomplishments || [] };
  } catch (error) {
    console.error('Error reading from localStorage', error);
    return { tasks: [], accomplishments: [] };
  }
};

export const TaskProvider = ({ children }: { children: ReactNode }) => {
  const { user, loading: authLoading } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [accomplishments, setAccomplishments] = useState<Accomplishment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    if (!authLoading) {
      if (user?.email) {
        const state = getInitialState(user.email);
        setTasks(state.tasks);
        setAccomplishments(state.accomplishments);
      } else {
        setTasks([]); 
        setAccomplishments([]);
      }
      setIsLoading(false);
    }
  }, [user, authLoading]);
  
  useEffect(() => {
    if (!isLoading && user) {
      try {
        const key = `${LOCAL_STORAGE_KEY}-${user.email}`;
        const state = { tasks, accomplishments };
        window.localStorage.setItem(key, JSON.stringify(state));
      } catch (error) {
        console.error('Error writing to localStorage', error);
      }
    }
  }, [tasks, accomplishments, isLoading, user]);

  const addTask = useCallback((taskData: Omit<Task, 'id' | 'createdAt' | 'rejectionCount' | 'isMuted' | 'completedAt' | 'lastRejectedAt'> & { parentId?: string }) => {
    const newTask: Task = {
      ...taskData,
      id: new Date().toISOString() + Math.random(),
      createdAt: Date.now(),
      rejectionCount: 0,
      isMuted: false,
    };
    setTasks(prev => [...prev, newTask]);
  }, []);

  const updateTask = useCallback((id: string, updates: Partial<Omit<Task, 'id' | 'createdAt'>>) => {
    setTasks(prev => prev.map(t => (t.id === id ? { ...t, ...updates } : t)));
  }, []);

  const deleteTask = useCallback((id: string) => {
     // Also delete all children of this task
    setTasks(prev => prev.filter(t => t.id !== id && t.parentId !== id));
  }, []);
  
  const acceptTask = useCallback((id: string) => {
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

    updateTask(id, { completedAt: Date.now() });
  }, [tasks, updateTask, toast]);

  const rejectTask = useCallback((id: string) => {
    const task = tasks.find(t => t.id === id);
    if (task) {
      updateTask(id, {
        rejectionCount: (task.rejectionCount || 0) + 1,
        lastRejectedAt: Date.now(),
      });
    }
  }, [tasks, updateTask]);

  const muteTask = useCallback((id: string) => {
    updateTask(id, { isMuted: true });
  }, [updateTask]);

  const uncompleteTask = useCallback((id: string) => {
    const task = tasks.find(t => t.id === id);
    if (task) {
      // Also un-complete all children
      const childrenIds = tasks.filter(t => t.parentId === id).map(t => t.id);
      setTasks(prev => prev.map(t => {
        if (t.id === id || childrenIds.includes(t.id)) {
          return {
            ...t,
            completedAt: undefined,
            rejectionCount: 0,
            lastRejectedAt: undefined,
          };
        }
        return t;
      }));
    }
  }, [tasks]);

  const addAccomplishment = useCallback((content: string) => {
    const newAccomplishment: Accomplishment = {
      id: new Date().toISOString() + Math.random(),
      date: new Date().toISOString().split('T')[0], // YYYY-MM-DD
      content,
    };
    setAccomplishments(prev => [...prev, newAccomplishment]);
  }, []);
  
  return (
    <TaskContext.Provider value={{ tasks, accomplishments, addAccomplishment, addTask, updateTask, deleteTask, acceptTask, rejectTask, muteTask, uncompleteTask, isLoading: isLoading || authLoading }}>
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
