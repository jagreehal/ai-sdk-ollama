import { tool } from 'ai';
import { z } from 'zod';
import type { Ollama } from 'ollama';
import { OllamaError } from '../utils/ollama-error';

// Use the actual Ollama type which includes web fetch methods (available in v0.6.0+)
type OllamaWithWebFetch = Ollama;

/**
 * Configuration options for the web fetch tool
 */
export interface WebFetchToolOptions {
  /**
   * Timeout for fetch requests in milliseconds
   * @default 30000
   */
  timeout?: number;

  /**
   * Maximum content length to return in characters
   * @default 10000
   */
  maxContentLength?: number;

  /**
   * Ollama client instance to use for web fetch
   * If not provided, will need to be injected at runtime
   */
  client?: OllamaWithWebFetch;
}

/**
 * Input schema for web fetch requests
 */
export const webFetchInputSchema = z.object({
  url: z
    .string()
    .url('Must be a valid URL')
    .describe('The URL to fetch content from'),
});

// Convert Zod schema to JSON schema for better compatibility
export const webFetchInputJsonSchema = {
  type: 'object',
  properties: {
    url: {
      type: 'string',
      format: 'uri',
      description: 'The URL to fetch content from',
    },
  },
  required: ['url'],
  additionalProperties: false,
} as const;

type WebFetchInput = z.infer<typeof webFetchInputSchema>;

/**
 * Output schema for web fetch results
 */
export type WebFetchOutput = {
  content: string;
  title?: string;
  url: string;
  contentLength: number;
  error?: string;
};

/**
 * Creates a web fetch tool that allows AI models to retrieve content from specific URLs.
 *
 * This tool uses Ollama's web fetch capabilities to retrieve and parse web page content,
 * making it accessible to AI models for analysis, summarization, or answering questions
 * about specific web pages.
 *
 * @param options - Configuration options for the web fetch tool
 * @returns A tool that can be used in AI SDK generateText/streamText calls
 *
 * @example
 * ```typescript
 * import { generateText } from 'ai';
 * import { ollama } from 'ai-sdk-ollama';
 *
 * const result = await generateText({
 *   model: ollama('llama3.2'),
 *   prompt: 'Summarize the main points from this article: https://example.com/article',
 *   tools: {
 *     webFetch: ollama.tools.webFetch()
 *   }
 * });
 * ```
 */
export function webFetch(options: WebFetchToolOptions = {}) {
  return tool<WebFetchInput, WebFetchOutput>({
    description:
      'Fetch and read content from a specific web URL. Use this to retrieve the full text content of web pages, articles, documentation, or any publicly accessible web content for analysis or summarization.',
    inputSchema: webFetchInputSchema,
    execute: async (input, context) => {
      const abortSignal = context?.abortSignal;
      const client = options.client;
      if (!client) {
        throw new OllamaError({
          message:
            'Ollama client not available for web fetch. This should not happen in normal usage.',
          cause: new Error('Missing Ollama client instance'),
        });
      }

      try {
        // Use Ollama's web fetch capability (v0.6.0+)
        if (!client.webFetch) {
          throw new OllamaError({
            message:
              'Web fetch is not available. Please upgrade to Ollama v0.6.0 or later.',
            cause: new Error('webFetch method not found on client'),
          });
        }

        const fetchResponse = await client.webFetch({
          url: input.url,
          // Add timeout support if available in the client
          ...(options.timeout && { timeout: options.timeout }),
        });

        // Extract content from the response
        const fetchResult =
          (fetchResponse as { content?: string; title?: string }) || {};

        // Extract and limit content if needed
        let content = fetchResult.content || '';
        const maxLength = options.maxContentLength ?? 10_000;

        if (content.length > maxLength) {
          content = content.slice(0, maxLength) + '\n\n[Content truncated...]';
        }

        const output: WebFetchOutput = {
          content,
          title: fetchResult.title || undefined,
          url: input.url,
          contentLength: content.length,
        };

        return output;
      } catch (error) {
        // Handle fetch errors gracefully by returning error info
        // This allows the model to understand what went wrong
        let errorMessage = 'Unknown error occurred';

        if (error instanceof Error) {
          errorMessage = error.message;

          // Handle specific error types
          if (error.message.includes('API key')) {
            errorMessage =
              'Web fetch requires an Ollama API key. Please set OLLAMA_API_KEY environment variable.';
          } else if (error.message.includes('rate limit')) {
            errorMessage =
              'Web fetch rate limit exceeded. Please try again later.';
          } else if (error.message.includes('timeout')) {
            errorMessage =
              'Web fetch request timed out. The URL may be slow to respond.';
          } else if (error.message.includes('404')) {
            errorMessage = 'The requested URL was not found (404 error).';
          } else if (error.message.includes('403')) {
            errorMessage = 'Access to the URL is forbidden (403 error).';
          } else if (
            error.message.includes('SSL') ||
            error.message.includes('certificate')
          ) {
            errorMessage = 'SSL/Certificate error when accessing the URL.';
          } else if (abortSignal?.aborted) {
            errorMessage = 'Web fetch request was cancelled.';
          }
        }

        // Return error information instead of throwing
        // This allows the model to understand and potentially work around the issue
        const output: WebFetchOutput = {
          content: '',
          url: input.url,
          contentLength: 0,
          error: errorMessage,
        };

        return output;
      }
    },
  });
}
