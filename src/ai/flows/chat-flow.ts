
'use server';
/**
 * @fileOverview Enhanced conversational chat flow with comprehensive user context.
 *
 * - chat - The main function that handles the chat interaction.
 * - ChatInput - The input type for the chat function.
 * - ChatOutput - The return type for the chat function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import type { Task, ChatContext } from '@/lib/types';

// Define a Zod schema for a single task to be used in the input.
const TaskSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().optional(),
  category: z.string(),
  energyLevel: z.enum(['Low', 'Medium', 'High']),
  duration: z.number(),
  completedAt: z.number().optional(),
  parentId: z.string().optional(),
  priority: z.enum(['Low', 'Medium', 'High', 'Critical']).optional(),
  createdAt: z.number().optional(),
});

const ChatContextSchema = z.object({
  tasks: z.array(TaskSchema),
  categories: z.array(z.string()),
  accomplishments: z.array(z.object({
    id: z.string(),
    date: z.string(),
    content: z.string(),
  })).optional(),
  userSettings: z.object({
    taskCategories: z.array(z.string()),
    taskDurations: z.array(z.number()),
  }).optional(),
  recentActivity: z.object({
    completedTasks: z.number(),
    createdTasks: z.number(),
    overdueTasksCount: z.number(),
  }).optional(),
});

const ChatInputSchema = z.object({
  message: z.string().describe("The user's message."),
  context: ChatContextSchema.describe("Complete user context including tasks, categories, and activity."),
  conversationHistory: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string(),
  })).optional().describe("Recent conversation history for context."),
});
export type ChatInput = z.infer<typeof ChatInputSchema>;

const SuggestedTaskSchema = z.object({
    title: z.string().describe("The title of the suggested task."),
    description: z.string().describe("A brief, encouraging description for the new task."),
    category: z.string().optional().describe("Suggested category for the task."),
    priority: z.enum(['Low', 'Medium', 'High', 'Critical']).optional().describe("Suggested priority level."),
    duration: z.number().optional().describe("Estimated duration in minutes."),
});

const QuickActionSchema = z.object({
  id: z.string().describe("Unique identifier for the action."),
  label: z.string().describe("Display label for the action button."),
  action: z.string().describe("The action type (e.g., 'list_overdue', 'suggest_priorities')."),
  data: z.any().optional().describe("Optional data payload for the action."),
});

const TaskReferenceSchema = z.object({
  taskId: z.string().describe("ID of the referenced task."),
  taskTitle: z.string().describe("Title of the referenced task."),
  action: z.enum(['view', 'edit', 'complete', 'delete']).describe("Suggested action for the task."),
});

const ChatOutputSchema = z.object({
  response: z.string().describe("The AI's response to the user."),
  suggestedTasks: z.array(SuggestedTaskSchema).optional().describe("New tasks suggested by the AI."),
  quickActions: z.array(QuickActionSchema).optional().describe("Quick action buttons for common operations."),
  taskReferences: z.array(TaskReferenceSchema).optional().describe("References to existing tasks with suggested actions."),
  followUpQuestions: z.array(z.string()).optional().describe("Suggested follow-up questions to continue the conversation."),
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
  name: 'enhancedChatPrompt',
  input: { schema: ChatInputSchema },
  output: { schema: ChatOutputSchema },
  prompt: `You are MindMate, an intelligent, empathetic, and highly capable AI task companion. Your role is to help users manage their tasks, increase productivity, provide motivation, and offer strategic guidance for their personal and professional goals.

## USER CONTEXT:
### Current Tasks ({{context.tasks.length}} total):
{{#if context.tasks}}
  {{#each context.tasks}}
    - **{{this.title}}** ({{this.category}}, {{this.priority}} priority, {{this.duration}} mins)
      {{#if this.description}}Description: {{this.description}}{{/if}}
      {{#if this.completedAt}}✅ Completed{{else}}⏳ Pending{{/if}}
      {{#if this.parentId}}└─ Subtask{{/if}}
  {{/each}}
{{else}}
  No tasks yet - perfect time to start planning!
{{/if}}

### Available Categories: {{#each context.categories}}{{this}}{{#unless @last}}, {{/unless}}{{/each}}

### Recent Activity:
{{#if context.recentActivity}}
  - Completed: {{context.recentActivity.completedTasks}} tasks
  - Created: {{context.recentActivity.createdTasks}} new tasks  
  - Overdue: {{context.recentActivity.overdueTasksCount}} tasks
{{else}}
  - Getting started with task management
{{/if}}

### Recent Accomplishments:
{{#if context.accomplishments}}
  {{#each context.accomplishments}}
    - {{this.content}} ({{this.date}})
  {{/each}}
{{else}}
  Ready to track new accomplishments!
{{/if}}

## CAPABILITIES & RESPONSE GUIDELINES:

**Core Functions:**
1. **Task Breakdown**: When users mention large/overwhelming tasks, ALWAYS offer to break them into 2-4 smaller, actionable steps
2. **Priority Guidance**: Help prioritize tasks based on urgency, importance, and context
3. **Time Management**: Suggest optimal scheduling and time blocking
4. **Motivation & Support**: Provide encouragement and help overcome procrastination
5. **Strategic Planning**: Help with goal setting and planning approaches

**Response Requirements:**
- Keep responses conversational, supportive, and actionable
- Always consider the user's current task load and context
- Suggest specific next steps when appropriate
- Be proactive in offering relevant quick actions

**Special Instructions:**
- For task breakdown requests: Populate 'suggestedTasks' array with detailed, actionable steps
- For task management queries: Include relevant 'taskReferences' with suggested actions
- For common operations: Provide 'quickActions' for easy access
- Always end with relevant 'followUpQuestions' to continue the conversation

**Quick Action Types:**
- list_overdue: Show overdue tasks
- suggest_priorities: Recommend task priorities  
- plan_day: Help plan today's schedule
- review_progress: Analyze recent progress
- break_down_task: Offer to break down a specific task
- time_blocking: Suggest time blocks for tasks

**Task Reference Actions:**
- view: Look at task details
- edit: Modify task properties
- complete: Mark task as done
- delete: Remove task

User's message: {{{message}}}

Respond as MindMate with helpful, contextual advice and actionable suggestions.`,
});

const chatFlow = ai.defineFlow(
  {
    name: 'enhancedChatFlow',
    inputSchema: ChatInputSchema,
    outputSchema: ChatOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    return output!;
  }
);
