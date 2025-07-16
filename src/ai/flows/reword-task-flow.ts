
'use server';
/**
 * @fileOverview An AI flow to reword a task to make it less daunting.
 *
 * - rewordTask - A function that handles the task rewording process.
 */

import { ai } from '@/ai/genkit';
import { RewordTaskInputSchema, RewordTaskOutputSchema, type RewordTaskInput, type RewordTaskOutput } from '@/lib/types';


export async function rewordTask(input: RewordTaskInput): Promise<RewordTaskOutput> {
  const { output } = await rewordTaskFlow(input);
    if (!output) {
        throw new Error("AI failed to generate a suggestion.");
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

Your job is to rephrase this task into a simple, concrete, and achievable first step.
The new title should be an action the user can take right now.
The new description should be short and encouraging.

For example, if the task is "Write the quarterly report", a good rephrasing would be:
New Title: "Open a new document and write down 3 bullet points for the report"
New Description: "Just get the basics down. No need to write the whole thing, just start with a few ideas!"

Another example, if the task is "Clean the entire kitchen":
New Title: "Clear off one counter in the kitchen"
New Description: "Let's just start with one small surface. It'll only take a few minutes!"

Now, rephrase the user's task.`,
});

const rewordTaskFlow = ai.defineFlow(
  {
    name: 'rewordTaskFlow',
    inputSchema: RewordTaskInputSchema,
    outputSchema: RewordTaskOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    return output!;
  }
);
