 
import { describe, expect, it, beforeAll } from 'vitest';
import { generateText } from 'ai';
import { ollama } from '../index';

describe('Web Search Tools Integration', () => {
  beforeAll(() => {
    // Skip tests if no API key is available
    if (!process.env.OLLAMA_API_KEY) {
      console.warn(
        '⚠️  OLLAMA_API_KEY not found - skipping web search integration tests',
      );
    }
  });

  it.skipIf(!process.env.OLLAMA_API_KEY)(
    'should perform basic web search with cloud model',
    async () => {
      const result = await generateText({
        model: ollama('qwen3:480b-cloud'),
        prompt:
          'Search for recent news about artificial intelligence and provide a brief summary.',
        tools: {
          // @ts-expect-error - ollama.tools.webSearch is not typed
          webSearch: ollama.tools.webSearch,
        },
      });

      expect(result.text).toBeDefined();
      expect(result.text.length).toBeGreaterThan(0);

      if (result.toolCalls && result.toolCalls.length > 0) {
        expect(result.toolCalls[0]?.toolName).toBe('webSearch');
        expect(result.toolCalls[0]?.input).toEqual(expect.any(String));
      }
    },
    30_000,
  ); // 30 second timeout for web search

  it.skipIf(!process.env.OLLAMA_API_KEY)(
    'should handle web fetch with cloud model',
    async () => {
      const result = await generateText({
        model: ollama('gpt-oss:120b-cloud'),
        prompt: 'Fetch the content from https://example.com and summarize it.',
        tools: {
          webFetch: ollama.tools.webFetch(),
        },
      });

      expect(result.text).toBeDefined();
      expect(result.text.length).toBeGreaterThan(0);

      if (result.toolCalls && result.toolCalls.length > 0) {
        expect(result.toolCalls[0]?.toolName).toBe('webFetch');
        expect(result.toolCalls[0]?.input).toEqual(expect.any(String));
      }
    },
    30_000,
  ); // 30 second timeout for web fetch

  it.skipIf(!process.env.OLLAMA_API_KEY)(
    'should combine web search and fetch with cloud model',
    async () => {
      const result = await generateText({
        model: ollama('deepseek-v3.1-cloud'),
        prompt:
          'Search for recent articles about TypeScript, then fetch and summarize the most relevant one.',
        tools: {
          webSearch: ollama.tools.webSearch(),
          webFetch: ollama.tools.webFetch(),
        },
      });

      expect(result.text).toBeDefined();
      expect(result.text.length).toBeGreaterThan(0);

      // Should have made at least one tool call
      if (result.toolCalls && result.toolCalls.length > 0) {
        const toolNames = result.toolCalls.map((call) => call.toolName);
        expect(toolNames).toContain('webSearch');
      }
    },
    60_000,
  ); // 60 second timeout for combined operations

  it.skipIf(!process.env.OLLAMA_API_KEY)(
    'should handle web fetch errors gracefully',
    async () => {
      const result = await generateText({
        model: ollama('qwen3:480b-cloud'),
        prompt:
          'Try to fetch content from https://this-domain-definitely-does-not-exist-123456.com and explain what happened.',
        tools: {
          webFetch: ollama.tools.webFetch(),
        },
      });

      expect(result.text).toBeDefined();
      expect(result.text.length).toBeGreaterThan(0);

      // The model should acknowledge the error
      expect(result.text.toLowerCase()).toMatch(
        /error|failed|not found|unable/i,
      );
    },
    30_000,
  );

  it.skipIf(!process.env.OLLAMA_API_KEY)(
    'should work with different cloud models',
    async () => {
      const models = [
        'qwen3:480b-cloud',
        'gpt-oss:120b-cloud',
        'deepseek-v3.1-cloud',
      ];

      for (const modelId of models) {
        const result = await generateText({
          model: ollama(modelId),
          prompt:
            'What is the current date and time? Search for this information.',
          tools: {
            webSearch: ollama.tools.webSearch(),
          },
        });

        expect(result.text).toBeDefined();
        expect(result.text.length).toBeGreaterThan(0);
      }
    },
    90_000,
  ); // 90 second timeout for multiple models
});
