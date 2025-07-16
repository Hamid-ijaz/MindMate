
'use server';
/**
 * @fileOverview An AI flow to summarize the content of a URL.
 *
 * - summarizeUrl - A function that handles the URL summarization process.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { parse } from 'node-html-parser';

// Define the tool for fetching URL content.
const fetchUrlContentTool = ai.defineTool(
  {
    name: 'fetchUrlContent',
    description: 'Fetches the text content of a given URL.',
    inputSchema: z.object({ url: z.string().url() }),
    outputSchema: z.string(),
  },
  async ({ url }) => {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        return `Error: Could not fetch URL, status code: ${response.status}`;
      }
      const html = await response.text();
      // Use node-html-parser to get the text content, which is better than regex
      const root = parse(html);
      const bodyText = root.querySelector('body')?.text || '';
      // Return a simplified version of the text to keep it manageable
      return bodyText.replace(/\s\s+/g, ' ').trim().substring(0, 5000);
    } catch (e: any) {
      return `Error fetching URL: ${e.message}`;
    }
  }
);

const SummarizeUrlInputSchema = z.object({
  url: z.string().url().describe('The URL to summarize.'),
});
type SummarizeUrlInput = z.infer<typeof SummarizeUrlInputSchema>;

const SummarizeUrlOutputSchema = z.object({
  summary: z.string().describe('A concise summary of the content found at the URL.'),
});
type SummarizeUrlOutput = z.infer<typeof SummarizeUrlOutputSchema>;


export async function summarizeUrl(input: SummarizeUrlInput): Promise<SummarizeUrlOutput> {
  const output = await summarizeUrlFlow(input);
  if (!output) {
      throw new Error("AI failed to generate a summary.");
  }
  return output;
}

const prompt = ai.definePrompt({
  name: 'summarizeUrlPrompt',
  input: { schema: SummarizeUrlInputSchema },
  output: { schema: SummarizeUrlOutputSchema },
  tools: [fetchUrlContentTool], // Make the tool available to the prompt
  prompt: `You are a helpful assistant. The user has provided a URL. 
  
  Your task is to:
  1. Use the 'fetchUrlContent' tool to get the text content from the URL: {{{url}}}.
  2. Read the content you receive from the tool.
  3. Based on the content, write a clear and concise one-paragraph summary. This summary will be used as the description for a new task.
  4. If the tool returns an error or no content, your summary should be "Could not retrieve content from the URL."
  `,
});


const summarizeUrlFlow = ai.defineFlow(
  {
    name: 'summarizeUrlFlow',
    inputSchema: SummarizeUrlInputSchema,
    outputSchema: SummarizeUrlOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    return output!;
  }
);
