
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

const EnhanceTaskInputSchema = z.object({
  title: z.string().describe('The original title of the task provided by the user.'),
});
export type EnhanceTaskInput = z.infer<typeof EnhanceTaskInputSchema>;

const EnhanceTaskOutputSchema = z.object({
  rephrasedTitle: z.string().describe("A clearer, more engaging, or more actionable version of the task title."),
  description: z.string().describe("A helpful and concise description for the task, based on the rephrased title."),
});
export type EnhanceTaskOutput = z.infer<typeof EnhanceTaskOutputSchema>;


export async function enhanceTask(input: EnhanceTaskInput): Promise<EnhanceTaskOutput> {
  const output = await enhanceTaskFlow(input);
  if (!output) {
      throw new Error("AI failed to enhance the task.");
  }
  return output;
}

const prompt = ai.definePrompt({
  name: 'enhanceTaskPrompt',
  input: { schema: EnhanceTaskInputSchema },
  output: { schema: EnhanceTaskOutputSchema },
  prompt: `You are an expert productivity assistant. Your goal is to help users clarify their tasks.

A user has provided the following task title:
"{{{title}}}"

Your tasks are:
1. Rephrase the title to be more actionable, clear, and motivating. If the title is already good, you can make minor improvements or keep it as is.
2. Based on the *rephrased* title, write a brief, helpful description (1-2 sentences) that elaborates on the task.

Example:
User Input Title: "team meeting"
Rephrased Title: "Prepare agenda for weekly team sync"
Description: "Outline key discussion points, and gather necessary documents for the upcoming weekly team meeting to ensure a productive session."

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
