
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
  message: z.string().describe("The user's message."),
  tasks: z.array(TaskSchema).describe("The user's current list of tasks."),
});
export type ChatInput = z.infer<typeof ChatInputSchema>;


const SuggestedTaskSchema = z.object({
    title: z.string().describe("The title of the suggested task."),
    description: z.string().describe("A brief, encouraging description for the new task."),
});

const ChatOutputSchema = z.object({
  response: z.string().describe("The AI's response to the user."),
  suggestedTasks: z.array(SuggestedTaskSchema).optional().describe("A list of new tasks suggested by the AI, if the user asked to break down a larger task."),
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

IMPORTANT: If the user asks you to "break down a task" or "make a task smaller", you MUST respond by populating the 'suggestedTasks' array with 2-3 smaller, concrete, and actionable steps. Your main 'response' text should introduce these suggestions.

For example, if the user says "Can you break down 'Write the quarterly report'?", your response should be:
- response: "Of course! Here are a few smaller steps to get you started:"
- suggestedTasks: [
    { title: "Create an outline for the report", description: "Just the main sections. Takes about 15 mins." },
    { title: "Gather the sales data for Q3", description: "Find the relevant numbers you'll need." },
    { title: "Write the introduction paragraph", description: "Just get the first few sentences down." }
]

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
