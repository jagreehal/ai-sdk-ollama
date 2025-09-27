import { webSearch } from './tool/web-search';
import { webFetch } from './tool/web-fetch';

/**
 * Ollama-specific tools that leverage the provider's web search capabilities.
 * Follows the same pattern as Google and OpenAI providers.
 */
export const ollamaTools = {
  /**
   * Creates a web search tool that allows models to search the internet for current information.
   *
   * @param options - Configuration options for the web search tool
   * @returns A tool that can search the web and return relevant results
   *
   * @example
   * ```typescript
   * import { ollama } from 'ai-sdk-ollama';
   * import { generateText } from 'ai';
   *
   * const result = await generateText({
   *   model: ollama('llama3.2'),
   *   prompt: 'What are the latest AI developments?',
   *   tools: {
   *     webSearch: ollama.tools.webSearch({ maxResults: 5 })
   *   }
   * });
   * ```
   */
  webSearch,

  /**
   * Creates a web fetch tool that allows models to retrieve content from specific URLs.
   *
   * @param options - Configuration options for the web fetch tool
   * @returns A tool that can fetch web page content
   *
   * @example
   * ```typescript
   * import { ollama } from 'ai-sdk-ollama';
   * import { generateText } from 'ai';
   *
   * const result = await generateText({
   *   model: ollama('llama3.2'),
   *   prompt: 'Summarize the content from https://example.com',
   *   tools: {
   *     webFetch: ollama.tools.webFetch()
   *   }
   * });
   * ```
   */
  webFetch,
} as const;
