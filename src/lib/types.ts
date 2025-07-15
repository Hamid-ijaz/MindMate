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


// Zod schema for a single task, to be used in the list
const TaskSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().optional(),
  category: z.enum(taskCategories),
  energyLevel: z.enum(energyLevels),
  duration: z.coerce.number().refine((val) => taskDurations.includes(val as (typeof taskDurations)[number])),
  timeOfDay: z.enum(timesOfDay),
  rejectionCount: z.number(),
  isMuted: z.boolean(),
  lastRejectedAt: z.number().optional(),
  completedAt: z.number().optional(),
  createdAt: z.number()
});


export const SuggestTaskInputSchema = z.object({
  tasks: z.array(TaskSchema).describe("The list of all available, uncompleted tasks for the user."),
  energyLevel: z.enum(energyLevels).describe("The user's current self-reported energy level."),
});
export type SuggestTaskInput = z.infer<typeof SuggestTaskInputSchema>;

export const SuggestTaskOutputSchema = z.object({
    suggestionText: z.string().describe("A short, friendly, and encouraging phrase to present the suggested task. Vary the phrasing."),
    suggestedTask: TaskSchema.omit({ isMuted: true, lastRejectedAt: true, completedAt: true, createdAt: true }).nullable().describe("The single best task for the user to do right now. If no tasks are suitable, this can be null."),
    otherTasks: z.array(TaskSchema).describe("All other tasks that were not suggested, which the user can view.")
});
export type SuggestTaskOutput = z.infer<typeof SuggestTaskOutputSchema>;
