
'use server';
/**
 * @fileOverview A conversational chat flow that has context of the user's tasks.
 *
 * - chat - The main function that handles the chat interaction.
 * - ChatInput - The input type for the chat function.
 * - ChatOutput - The return type for the chat function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import type { Task } from '@/lib/types';

// Define a Zod schema for a single task to be used in the input.
const TaskSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().optional(),
  category: z.enum(['Work', 'Chores', 'Writing', 'Personal', 'Study']),
  energyLevel: z.enum(['Low', 'Medium', 'High']),
  duration: z.number(),
  timeOfDay: z.enum(['Morning', 'Afternoon', 'Evening']),
  completedAt: z.number().optional(),
});

const ChatInputSchema = z.object({
  message: z.string().describe('The user\'s message.'),
  tasks: z.array(TaskSchema).describe('The user\'s current list of tasks.'),
});
export type ChatInput = z.infer<typeof ChatInputSchema>;

const ChatOutputSchema = z.object({
  response: z.string().describe('The AI\'s response to the user.'),
});
export type ChatOutput = z.infer<typeof ChatOutputSchema>;

export async function chat(input: ChatInput): Promise<ChatOutput> {
  const output = await chatFlow(input);
  if (!output) {
    throw new Error("AI failed to generate a response.");
  }
  return output;
}

const prompt = ai.definePrompt({
  name: 'chatPrompt',
  input: { schema: ChatInputSchema },
  output: { schema: ChatOutputSchema },
  prompt: `You are MindMate, a friendly, supportive, and adaptive task companion. Your goal is to help the user manage their tasks, stay motivated, and overcome procrastination.

You have access to the user's current task list.

Here is the user's current task list:
{{#if tasks}}
  {{#each tasks}}
    - Task: "{{this.title}}" ({{this.energyLevel}} Energy, {{this.duration}} mins) - {{#if this.completedAt}}Completed{{else}}Pending{{/if}}
  {{/each}}
{{else}}
  The user has no tasks.
{{/if}}

Keep your responses concise, helpful, and conversational. You can answer questions about their tasks, help them decide what to do next, offer encouragement, or just chat.

User's message: {{{message}}}
`,
});


const chatFlow = ai.defineFlow(
  {
    name: 'chatFlow',
    inputSchema: ChatInputSchema,
    outputSchema: ChatOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    return output!;
  }
);
