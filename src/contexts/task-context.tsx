
"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import type { Task, EnergyLevel, TimeOfDay } from '@/lib/types';
import { REJECTION_HOURS, LOCAL_STORAGE_KEY } from '@/lib/constants';
import { getCurrentTimeOfDay } from '@/lib/utils';
import { useAuth } from './auth-context';

interface TaskContextType {
  tasks: Task[];
  addTask: (task: Omit<Task, 'id' | 'createdAt' | 'rejectionCount' | 'isMuted' | 'completedAt' | 'lastRejectedAt'>) => void;
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
      const energyMap = { Low: 1, Medium: 2, High: 3 };
      // Suggest tasks with equal or lower energy requirements
      return energyMap[taskEnergy] <= energyMap[userEnergy];
    };

    const timeMatch = (taskTime: TimeOfDay, currentTime: TimeOfDay) => {
      // Prioritize tasks for the current time of day
      if (taskTime === currentTime) return true;
      // Also allow "any time" tasks (e.g. if we add that category later)
      return false;
    };

    const scoredTasks = availableTasks.map(task => {
      let score = 100;
      if (energyMatch(task.energyLevel, energy)) {
        score += 50;
        // give a bonus for exact energy match
        if (task.energyLevel === energy) score += 10;
      } else {
        score -= 200; // Heavily penalize energy mismatch
      }
      
      if (timeMatch(task.timeOfDay, timeOfDay)) score += 30;
      
      // Penalize rejections more heavily
      score -= (task.rejectionCount || 0) * 25;
      
      // Bonus for older, un-actioned tasks to prevent them from getting lost
      const ageInDays = (now - task.createdAt) / (1000 * 60 * 60 * 24);
      score += Math.min(ageInDays * 2, 20); // Add up to 20 points for age

      return { task, score };
    })
    .filter(item => item.score > 0) // Filter out tasks that are not a good fit
    .sort((a, b) => b.score - a.score);

    if (scoredTasks.length === 0) return null;

    // Get top tasks with scores in a close range to the best score
    const topScore = scoredTasks[0].score;
    const topTasks = scoredTasks
        .filter(item => item.score >= topScore * 0.8) // e.g., within 80% of top score
        .map(item => item.task);
    
    // Pick a random one from the best options to add variety
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
