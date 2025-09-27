import { tool } from 'ai';
import { z } from 'zod';
import type { Ollama } from 'ollama';
import { OllamaError } from '../utils/ollama-error';

// Use the actual Ollama type which includes web search methods (available in v0.6.0+)
type OllamaWithWebSearch = Ollama;

/**
 * Configuration options for the web search tool
 */
export interface WebSearchToolOptions {
  /**
   * Timeout for search requests in milliseconds
   * @default 30000
   */
  timeout?: number;

  /**
   * Ollama client instance to use for web search
   * If not provided, will need to be injected at runtime
   */
  client?: OllamaWithWebSearch;
}

/**
 * Input schema for web search requests
 */
export const webSearchInputSchema = z.object({
  query: z
    .string()
    .min(1, 'Search query cannot be empty')
    .max(500, 'Search query too long')
    .describe('The search query to find relevant information on the web'),
  maxResults: z
    .number()
    .min(1, 'Must return at least 1 result')
    .max(20, 'Cannot return more than 20 results')
    .optional()
    .describe('Maximum number of search results to return (1-20)'),
});

// Convert Zod schema to JSON schema for better compatibility
export const webSearchInputJsonSchema = {
  type: 'object',
  properties: {
    query: {
      type: 'string',
      minLength: 1,
      maxLength: 500,
      description: 'The search query to find relevant information on the web',
    },
    maxResults: {
      type: 'integer',
      minimum: 1,
      maximum: 20,
      description: 'Maximum number of search results to return (1-20)',
    },
  },
  required: ['query'],
  additionalProperties: false,
} as const;

type WebSearchInput = z.infer<typeof webSearchInputSchema>;

/**
 * Output schema for web search results
 */
export type WebSearchOutput = {
  results: Array<{
    title: string;
    url: string;
    snippet: string;
    publishedDate?: string;
  }>;
  searchQuery: string;
  totalResults: number;
};

/**
 * Creates a web search tool that allows AI models to search the internet for current information.
 *
 * This tool uses Ollama's web search capabilities to provide models with access to real-time
 * web content, reducing hallucinations and improving accuracy for current events and recent information.
 *
 * @param options - Configuration options for the web search tool
 * @returns A tool that can be used in AI SDK generateText/streamText calls
 *
 * @example
 * ```typescript
 * import { generateText } from 'ai';
 * import { ollama } from 'ai-sdk-ollama';
 *
 * const result = await generateText({
 *   model: ollama('llama3.2'),
 *   prompt: 'What are the latest developments in AI this week?',
 *   tools: {
 *     webSearch: ollama.tools.webSearch
 *   }
 * });
 * ```
 */

function hasWebSearch(client: unknown): client is {
  webSearch: (args: Record<string, unknown>) => Promise<unknown>;
} {
  if (!client || typeof client !== 'object') {
    return false;
  }

  return typeof (client as { webSearch?: unknown }).webSearch === 'function';
}

export function webSearch(options: WebSearchToolOptions = {}) {
  return tool<WebSearchInput, WebSearchOutput>({
    description:
      'Search the web for current information about any topic. Use this when you need up-to-date information, recent news, current statistics, or real-time data that may not be in your training data.',
    inputSchema: webSearchInputSchema,
    execute: async (input, { abortSignal }) => {
      const client = options.client;
      if (!client) {
        throw new OllamaError({
          message:
            'Ollama client not available for web search. This should not happen in normal usage.',
          cause: new Error('Missing Ollama client instance'),
        });
      }

      try {
        const maxResults = Math.min(input.maxResults ?? 5, 20);

        // Use Ollama's web search capability (v0.6.0+)
        if (!hasWebSearch(client)) {
          throw new OllamaError({
            message:
              'Web search is not available. Please upgrade to Ollama v0.6.0 or later.',
            cause: new Error('webSearch method not found on client'),
          });
        }

        const searchResponse = await client.webSearch({
          query: input.query,
          maxResults,
          // Add timeout support if available in the client
          ...(options.timeout && { timeout: options.timeout }),
        });

        // Extract results from the response
        const searchResults =
          (
            searchResponse as {
              results?: Array<{
                title?: string;
                url?: string;
                snippet?: string;
                content?: string;
                publishedDate?: string;
                date?: string;
              }>;
            }
          ).results || [];

        // Transform Ollama results to our expected format
        const results = searchResults.map((result) => ({
          title: result.title || 'Untitled',
          url: result.url || '',
          snippet: result.snippet || result.content || '',
          publishedDate: result.publishedDate || result.date,
        }));

        const output: WebSearchOutput = {
          results,
          searchQuery: input.query,
          totalResults: results.length,
        };

        return output;
      } catch (error) {
        // Handle specific Ollama web search errors
        if (error instanceof Error) {
          if (error.message.includes('API key')) {
            throw new OllamaError({
              message:
                'Web search requires an Ollama API key. Please set OLLAMA_API_KEY environment variable or configure apiKey in provider settings.',
              cause: error,
            });
          }

          if (error.message.includes('rate limit')) {
            throw new OllamaError({
              message:
                'Web search rate limit exceeded. Please try again later or upgrade your Ollama plan.',
              cause: error,
            });
          }

          if (abortSignal?.aborted) {
            throw new OllamaError({
              message: 'Web search request was cancelled.',
              cause: error,
            });
          }
        }

        throw new OllamaError({
          message: `Web search failed: ${error instanceof Error ? error.message : String(error)}`,
          cause: error,
        });
      }
    },
  });
}
