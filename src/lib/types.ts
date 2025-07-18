
import { z } from "zod";

// These are now dynamic, but we define the type.
export type TaskCategory = string; 
export const taskCategories: [TaskCategory, ...TaskCategory[]] = ['Work', 'Chores', 'Writing', 'Personal', 'Study']; // Default values

export type EnergyLevel = 'Low' | 'Medium' | 'High';
export const energyLevels: [EnergyLevel, ...EnergyLevel[]] = ['Low', 'Medium', 'High'];

export type TaskDuration = number;
export const taskDurations: [TaskDuration, ...TaskDuration[]] = [15, 30, 60, 90]; // Default values

export type TimeOfDay = 'Morning' | 'Afternoon' | 'Evening';
export const timesOfDay: [TimeOfDay, ...TimeOfDay[]] = ['Morning', 'Afternoon', 'Evening'];

export type RecurrenceFrequency = 'none' | 'daily' | 'weekly' | 'monthly';
export const recurrenceFrequencies: RecurrenceFrequency[] = ['none', 'daily', 'weekly', 'monthly'];

export interface Task {
  id: string;
  userEmail: string;
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
  parentId?: string;
  reminderAt?: number;
  notifiedAt?: number;
  recurrence?: {
    frequency: RecurrenceFrequency;
    endDate?: number;
  };
}

export interface User {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  dob?: string;
  password?: string; // In a real app, this would be a hash
}

export interface Accomplishment {
    id: string;
    date: string; // YYYY-MM-DD
    content: string;
}

export interface Note {
    id: string;
    userEmail: string;
    title: string;
    content: string; // Will store HTML content for rich text
    imageUrl?: string;
    color?: string; // e.g., hex code for background color
    fontSize?: number; // New property for font size
    createdAt: number;
    updatedAt: number;
}

// Schema for the rewordTask AI flow
export const RewordTaskInputSchema = z.object({
  title: z.string().describe('The original title of the task.'),
  description: z.string().describe('The original description of the task.'),
});
export type RewordTaskInput = z.infer<typeof RewordTaskInputSchema>;

export const SuggestedTaskSchema = z.object({
    title: z.string().describe("The title of a smaller, actionable sub-task."),
    description: z.string().describe("A brief, encouraging description for the sub-task."),
});

export const RewordTaskOutputSchema = z.object({
  suggestedTasks: z.array(SuggestedTaskSchema).describe("A list of 2-4 smaller, concrete steps to break down the original task."),
});
export type RewordTaskOutput = z.infer<typeof RewordTaskOutputSchema>;
