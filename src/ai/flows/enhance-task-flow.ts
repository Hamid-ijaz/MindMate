
'use server';
/**
 * @fileOverview An AI flow to enhance a task title and generate a description.
 *
 * - enhanceTask - A function that handles the task enhancement process.
 * - EnhanceTaskInput - The input type for the enhanceTask function.
 * - EnhanceTaskOutput - The return type for the enhanceTask function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { priorities } from '@/lib/types';


const EnhanceTaskInputSchema = z.object({
  title: z.string().describe('The original title of the task provided by the user.'),
});
export type EnhanceTaskInput = z.infer<typeof EnhanceTaskInputSchema>;

const EnhanceTaskOutputSchema = z.object({
  rephrasedTitle: z.string().describe("A clearer, more engaging, or more actionable version of the task title."),
  description: z.string().describe("A helpful and concise description for the task, based on the rephrased title."),
  category: z.string().describe("The predicted category for the task."),
  priority: z.enum(priorities).describe("The predicted priority/urgency for the task."),
  duration: z.coerce.number().describe("The predicted duration in minutes for the task."),
});
export type EnhanceTaskOutput = z.infer<typeof EnhanceTaskOutputSchema>;


export async function enhanceTask(input: EnhanceTaskInput): Promise<EnhanceTaskOutput> {
  const output = await enhanceTaskFlow(input);
  if (!output) {
      throw new Error("AI failed to enhance the task.");
  }
  return output;
}

// In a real app, you would fetch these from the user's settings in the database.
// For this example, we'll simulate fetching them. In a real scenario, this would be an async DB call.
const getUserTaskSettings = () => {
    // This is a placeholder. In a real app, you'd have access to the current user's
    // settings from a database or a shared context that can be accessed on the server.
    // Since Genkit flows run on the server, we can't directly access localStorage here.
    // We pass them in the prompt for now.
    return {
        taskCategories: ['Work', 'Chores', 'Writing', 'Personal', 'Study'],
        taskDurations: [15, 30, 60, 90],
    }
}

const prompt = ai.definePrompt({
  name: 'enhanceTaskPrompt',
  input: { schema: EnhanceTaskInputSchema },
  output: { schema: EnhanceTaskOutputSchema },
  prompt: `You are an expert productivity assistant. Your goal is to help users clarify and categorize their tasks.

A user has provided the following task title:
"{{{title}}}"

Your tasks are:
1.  **Rephrase the title**: Make it more actionable, clear, and motivating. If the title is already good, you can make minor improvements or keep it as is.
2.  **Write a description**: Based on the *rephrased* title, write a brief, helpful description (1-2 sentences).
3.  **Predict attributes**: Based on the title and description, predict the following attributes for the task:
    *   \`category\`: Choose one from: \${getUserTaskSettings().taskCategories.join(', ')}.
            *   \`priority\`: Choose one from: \${priorities.join(', ')}.
    *   \`duration\`: Estimate the time required in minutes. Choose one from: \${getUserTaskSettings().taskDurations.join(', ')}.

Example:
User Input Title: "team meeting"
Output:
{
  "rephrasedTitle": "Prepare agenda for weekly team sync",
  "description": "Outline key discussion points, and gather necessary documents for the upcoming weekly team meeting to ensure a productive session.",
  "category": "Work",
          "priority": "Medium",
  "duration": 30
}

Example 2:
User Input Title: "gym"
Output:
{
  "rephrasedTitle": "Go for a workout at the gym",
  "description": "Complete today's planned workout session to build strength and improve fitness.",
  "category": "Personal",
          "priority": "High",
  "duration": 60
}

Now, process the user's task title.`,
});


const enhanceTaskFlow = ai.defineFlow(
  {
    name: 'enhanceTaskFlow',
    inputSchema: EnhanceTaskInputSchema,
    outputSchema: EnhanceTaskOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    return output!;
  }
);
