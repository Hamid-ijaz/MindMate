
"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import type { Task, EnergyLevel, TimeOfDay } from '@/lib/types';
import { REJECTION_HOURS, LOCAL_STORAGE_KEY } from '@/lib/constants';
import { getCurrentTimeOfDay } from '@/lib/utils';
import { useAuth } from './auth-context';

interface TaskContextType {
  tasks: Task[];
  addTask: (task: Omit<Task, 'id' | 'createdAt' | 'rejectionCount' | 'isMuted'>) => void;
  updateTask: (id: string, updates: Partial<Task>) => void;
  deleteTask: (id: string) => void;
  getSuggestedTask: (energy: EnergyLevel) => Task | null;
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
      const state = getInitialState(user?.email || null);
      setTasks(state.tasks);
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

  const addTask = useCallback((taskData: Omit<Task, 'id' | 'createdAt' | 'rejectionCount' | 'isMuted'>) => {
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
    setTasks(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
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

  const getSuggestedTask = useCallback((energy: EnergyLevel): Task | null => {
    const now = Date.now();
    const timeOfDay = getCurrentTimeOfDay();
    const rejectionLimit = now - REJECTION_HOURS * 60 * 60 * 1000;

    const availableTasks = tasks.filter(task =>
      !task.completedAt &&
      !task.isMuted &&
      (!task.lastRejectedAt || task.lastRejectedAt < rejectionLimit)
    );

    if (availableTasks.length === 0) return null;

    const energyMatch = (taskEnergy: EnergyLevel, userEnergy: EnergyLevel) => {
      if (userEnergy === 'High') return true;
      if (userEnergy === 'Medium') return taskEnergy !== 'High';
      if (userEnergy === 'Low') return taskEnergy === 'Low';
      return false;
    };

    const timeMatch = (taskTime: TimeOfDay, currentTime: TimeOfDay) => {
      return taskTime === currentTime;
    };

    const scoredTasks = availableTasks.map(task => {
      let score = 100;
      if (energyMatch(task.energyLevel, energy)) score += 50;
      if (timeMatch(task.timeOfDay, timeOfDay)) score += 30;
      score -= (task.rejectionCount || 0) * 20; // Penalize rejections
      return { task, score };
    }).sort((a, b) => b.score - a.score);

    // Get top tasks with the same highest score
    const topScore = scoredTasks[0]?.score;
    if (topScore === undefined) return null;
    
    const topTasks = scoredTasks.filter(item => item.score === topScore).map(item => item.task);
    
    // Pick a random one from the best options
    return topTasks[Math.floor(Math.random() * topTasks.length)];
  }, [tasks]);

  return (
    <TaskContext.Provider value={{ tasks, addTask, updateTask, deleteTask, getSuggestedTask, acceptTask, rejectTask, muteTask, isLoading: isLoading || authLoading }}>
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
