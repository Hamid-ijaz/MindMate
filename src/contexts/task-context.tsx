
"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import type { Task } from '@/lib/types';
import { LOCAL_STORAGE_KEY } from '@/lib/constants';
import { useAuth } from './auth-context';

interface TaskContextType {
  tasks: Task[];
  addTask: (task: Omit<Task, 'id' | 'createdAt' | 'rejectionCount' | 'isMuted' | 'completedAt' | 'lastRejectedAt'>) => void;
  updateTask: (id: string, updates: Partial<Task>) => void;
  deleteTask: (id: string) => void;
  acceptTask: (id: string) => void;
  rejectTask: (id: string) => void;
  muteTask: (id: string) => void;
  isLoading: boolean;
}

const TaskContext = createContext<TaskContextType | undefined>(undefined);

const getInitialState = (userEmail: string | null): { tasks: Task[] } => {
  if (typeof window === 'undefined' || !userEmail) {
    return { tasks: [] };
  }
  try {
    const key = `${LOCAL_STORAGE_KEY}-${userEmail}`;
    const item = window.localStorage.getItem(key);
    return item ? JSON.parse(item) : { tasks: [] };
  } catch (error) {
    console.error('Error reading from localStorage', error);
    return { tasks: [] };
  }
};

export const TaskProvider = ({ children }: { children: ReactNode }) => {
  const { user, loading: authLoading } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!authLoading) {
      if (user?.email) {
        const state = getInitialState(user.email);
        setTasks(state.tasks);
      } else {
        setTasks([]); // Clear tasks if user logs out
      }
      setIsLoading(false);
    }
  }, [user, authLoading]);
  
  useEffect(() => {
    if (!isLoading && user) {
      try {
        const key = `${LOCAL_STORAGE_KEY}-${user.email}`;
        const state = { tasks };
        window.localStorage.setItem(key, JSON.stringify(state));
      } catch (error) {
        console.error('Error writing to localStorage', error);
      }
    }
  }, [tasks, isLoading, user]);

  const addTask = useCallback((taskData: Omit<Task, 'id' | 'createdAt' | 'rejectionCount' | 'isMuted' | 'completedAt' | 'lastRejectedAt'>) => {
    const newTask: Task = {
      ...taskData,
      id: new Date().toISOString() + Math.random(),
      createdAt: Date.now(),
      rejectionCount: 0,
      isMuted: false,
    };
    setTasks(prev => [...prev, newTask]);
  }, []);

  const updateTask = useCallback((id: string, updates: Partial<Task>) => {
    setTasks(prev => prev.map(t => (t.id === id ? { ...t, ...updates, isMuted: updates.isMuted ?? t.isMuted } : t)));
  }, []);

  const deleteTask = useCallback((id: string) => {
    setTasks(prev => prev.filter(t => t.id !== id));
  }, []);
  
  const acceptTask = useCallback((id: string) => {
    updateTask(id, { completedAt: Date.now() });
  }, [updateTask]);

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
  
  return (
    <TaskContext.Provider value={{ tasks, addTask, updateTask, deleteTask, acceptTask, rejectTask, muteTask, isLoading: isLoading || authLoading }}>
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
