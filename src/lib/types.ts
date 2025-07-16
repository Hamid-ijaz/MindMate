
import { z } from "zod";

export type TaskCategory = 'Work' | 'Chores' | 'Writing' | 'Personal' | 'Study';
export const taskCategories: [TaskCategory, ...TaskCategory[]] = ['Work', 'Chores', 'Writing', 'Personal', 'Study'];

export type EnergyLevel = 'Low' | 'Medium' | 'High';
export const energyLevels: [EnergyLevel, ...EnergyLevel[]] = ['Low', 'Medium', 'High'];

export type TaskDuration = 15 | 30 | 60 | 90;
export const taskDurations: [TaskDuration, ...TaskDuration[]] = [15, 30, 60, 90];

export type TimeOfDay = 'Morning' | 'Afternoon' | 'Evening';
export const timesOfDay: [TimeOfDay, ...TimeOfDay[]] = ['Morning', 'Afternoon', 'Evening'];

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

export interface User {
  email: string;
  password?: string; // In a real app, this would be a hash
}

export interface Accomplishment {
    id: string;
    date: string; // YYYY-MM-DD
    content: string;
}

// Schema for the rewordTask AI flow
export const RewordTaskInputSchema = z.object({
  title: z.string().describe('The original title of the task.'),
  description: z.string().describe('The original description of the task.'),
});
export type RewordTaskInput = z.infer<typeof RewordTaskInputSchema>;

export const RewordTaskOutputSchema = z.object({
  title: z.string().describe('The new, rephrased title for the task that represents a smaller first step.'),
  description: z.string().describe('A new, encouraging description for the rephrased task.'),
});
export type RewordTaskOutput = z.infer<typeof RewordTaskOutputSchema>;
