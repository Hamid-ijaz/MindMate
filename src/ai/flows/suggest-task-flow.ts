'use server';
/**
 * @fileOverview A task suggestion AI agent.
 *
 * - suggestTask - A function that handles the task suggestion process.
 * - SuggestTaskInput - The input type for the suggestTask function.
 * - SuggestTaskOutput - The return type for the suggestTask function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import type { Task } from '@/lib/types';
import { energyLevels, taskCategories, taskDurations, timesOfDay } from '@/lib/types';

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
});

export const SuggestTaskInputSchema = z.object({
  tasks: z.array(TaskSchema).describe("The list of all available, uncompleted tasks for the user."),
  energyLevel: z.enum(energyLevels).describe("The user's current self-reported energy level."),
});
export type SuggestTaskInput = z.infer<typeof SuggestTaskInputSchema>;

export const SuggestTaskOutputSchema = z.object({
    suggestionText: z.string().describe("A short, friendly, and encouraging phrase to present the suggested task. Vary the phrasing."),
    suggestedTask: TaskSchema.nullable().describe("The single best task for the user to do right now. If no tasks are suitable, this can be null."),
    otherTasks: z.array(TaskSchema).describe("All other tasks that were not suggested, which the user can view.")
});
export type SuggestTaskOutput = z.infer<typeof SuggestTaskOutputSchema>;

export async function suggestTask(input: SuggestTaskInput): Promise<SuggestTaskOutput> {
  // If there are no tasks, return an empty state without calling the AI
  if (input.tasks.length === 0) {
    return {
      suggestionText: "You're all clear! Add some tasks to get started.",
      suggestedTask: null,
      otherTasks: [],
    };
  }
  return suggestTaskFlow(input);
}

const prompt = ai.definePrompt({
  name: 'suggestTaskPrompt',
  input: { schema: SuggestTaskInputSchema },
  output: { schema: SuggestTaskOutputSchema },
  prompt: `You are a friendly and insightful productivity coach named "Mindful Tasks". Your goal is to help the user pick the *one* perfect task to work on right now based on their available tasks and current energy level.

User's Current Energy Level: {{{energyLevel}}}

Here is the list of available tasks:
{{#each tasks}}
- Task: "{{this.title}}" (ID: {{this.id}}, Energy: {{this.energyLevel}}, Duration: {{this.duration}} mins, Rejections: {{this.rejectionCount}})
{{/each}}

Analyze the list and select the single best task for the user.
Your selection criteria:
1.  **Match Energy**: Prioritize tasks that match or are below the user's current energy level. Avoid suggesting high-energy tasks to a low-energy user.
2.  **Prioritize Easy Wins**: If the user's energy is low, suggest a low-energy, short-duration task to help them build momentum.
3.  **Avoid Rejected Tasks**: Tasks with a higher rejectionCount are less preferred. Try to suggest something else if a suitable alternative exists.
4.  **Variety**: Don't always suggest the same type of task.

Your response MUST be a valid JSON object adhering to the output schema.

-   **suggestionText**: Write a short, encouraging, and slightly varied phrase to ask the user if they want to do the suggested task. Examples: "Ready for this one?", "How about we tackle this next?", "Here's a thought... want to do this?".
-   **suggestedTask**: The full JSON object of the single task you recommend. If you determine no task is a good fit, return null for this field.
-   **otherTasks**: An array of all the tasks from the input list that you did *not* select as the suggestedTask.
`,
});

const suggestTaskFlow = ai.defineFlow(
  {
    name: 'suggestTaskFlow',
    inputSchema: SuggestTaskInputSchema,
    outputSchema: SuggestTaskOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    if (!output) {
        throw new Error("AI failed to generate a suggestion.");
    }

    // Ensure logic for when AI returns null suggestedTask
    if (!output.suggestedTask) {
        return {
            suggestionText: "Couldn't find the perfect fit right now. Maybe try something else?",
            suggestedTask: null,
            otherTasks: input.tasks
        }
    }
    
    return output;
  }
);
