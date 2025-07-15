export type TaskCategory = 'Work' | 'Chores' | 'Writing' | 'Personal' | 'Study';
export const taskCategories: TaskCategory[] = ['Work', 'Chores', 'Writing', 'Personal', 'Study'];

export type EnergyLevel = 'Low' | 'Medium' | 'High';
export const energyLevels: EnergyLevel[] = ['Low', 'Medium', 'High'];

export type TaskDuration = 15 | 30 | 60 | 90;
export const taskDurations: TaskDuration[] = [15, 30, 60, 90];

export type TimeOfDay = 'Morning' | 'Afternoon' | 'Evening';
export const timesOfDay: TimeOfDay[] = ['Morning', 'Afternoon', 'Evening'];

export interface Task {
  id: string;
  title: string;
  description?: string;
  category: TaskCategory;
  energyLevel: EnergyLevel;
  duration: TaskDuration;
  timeOfDay: TimeOfDay;
  createdAt: number;
  rejectionCount: number;
  lastRejectedAt?: number;
  isMuted: boolean;
  completedAt?: number;
}
