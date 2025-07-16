
'use server';
/**
 * @fileOverview An AI flow to break down a task into smaller, actionable steps.
 *
 * - rewordTask - A function that handles the task breakdown process.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';

// Define schemas and types locally within the flow file.
const RewordTaskInputSchema = z.object({
  title: z.string().describe('The original title of the task.'),
  description: z.string().describe('The original description of the task.'),
});
type RewordTaskInput = z.infer<typeof RewordTaskInputSchema>;

const SuggestedTaskSchema = z.object({
    title: z.string().describe("The title of a smaller, actionable sub-task."),
    description: z.string().describe("A brief, encouraging description for the sub-task."),
});

const RewordTaskOutputSchema = z.object({
  suggestedTasks: z.array(SuggestedTaskSchema).describe("A list of 2-4 smaller, concrete steps to break down the original task."),
});
type RewordTaskOutput = z.infer<typeof RewordTaskOutputSchema>;


// The exported function that the UI will call.
export async function rewordTask(input: RewordTaskInput): Promise<RewordTaskOutput> {
  const output = await rewordTaskFlow(input);
  if (!output) {
      throw new Error("AI failed to generate suggestions.");
  }
  return output;
}

const prompt = ai.definePrompt({
  name: 'rewordTaskPrompt',
  input: { schema: RewordTaskInputSchema },
  output: { schema: RewordTaskOutputSchema },
  prompt: `You are MindMate, a friendly and adaptive task companion. Your goal is to help users overcome procrastination by making tasks feel less overwhelming.

A user finds the following task intimidating:
Original Title: {{{title}}}
Original Description: {{{description}}}

Your job is to break this task down into 2-4 simple, concrete, and achievable first steps.
Each new title should be an action the user can take right now.
Each new description should be short and encouraging.

For example, if the task is "Write the quarterly report", a good breakdown would be:
suggestedTasks: [
    { title: "Create an outline for the report", description: "Just the main sections. Takes about 15 mins." },
    { title: "Gather the sales data for Q3", description: "Find the relevant numbers you'll need." },
    { title: "Write the introduction paragraph", description: "Just get the first few sentences down." }
]

Now, break down the user's task.`,
});

const rewordTaskFlow = ai.defineFlow(
  {
    name: 'rewordTaskFlow',
    inputSchema: RewordTaskInputSchema,
    outputSchema: RewordTaskOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    // The '!' tells TypeScript that we are confident `output` will not be null.
    // The function signature ensures the type is correct.
    return output!;
  }
);
