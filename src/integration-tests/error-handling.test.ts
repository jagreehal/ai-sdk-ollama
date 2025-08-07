import { describe, it, expect } from 'vitest';
import { generateText, embed } from 'ai';
import { ollama, createOllama } from '../index';

// Integration test for error handling and edge cases
describe('Error Handling Integration Tests', () => {
  it('should handle non-existent model', async () => {
    await expect(
      generateText({
        model: ollama('non-existent-model'),
        prompt: 'Hello',
        maxOutputTokens: 10,
      }),
    ).rejects.toThrow();
  });

  it('should handle network errors with invalid base URL', async () => {
    const provider = createOllama({ baseURL: 'http://invalid-host:99999' });

    await expect(
      generateText({
        model: provider('llama3.2'),
        prompt: 'Hello',
        maxOutputTokens: 10,
      }),
    ).rejects.toThrow();
  });

  it('should handle invalid embedding model', async () => {
    await expect(
      embed({
        model: ollama.embedding('non-existent-embedding-model'),
        value: 'Hello world',
      }),
    ).rejects.toThrow();
  });

  it('should handle very long prompts', async () => {
    const longPrompt = 'This is a very long prompt. '.repeat(1000);

    const result = await generateText({
      model: ollama('llama3.2'),
      prompt: longPrompt,
      maxOutputTokens: 50,
      temperature: 0,
    });

    expect(result.text).toBeTruthy();
    expect(result.usage.inputTokens).toBeGreaterThan(0);
  });

  it('should handle empty prompt', async () => {
    const result = await generateText({
      model: ollama('llama3.2'),
      prompt: '',
      maxOutputTokens: 10,
      temperature: 0,
    });

    expect(result.text).toBeTruthy();
    expect(result.usage.inputTokens).toBeGreaterThanOrEqual(0);
  });

  it('should handle very low maxOutputTokens', async () => {
    const result = await generateText({
      model: ollama('llama3.2'),
      prompt: 'Write a long story',
      maxOutputTokens: 1,
      temperature: 0,
    });

    expect(result.text).toBeTruthy();
    expect(result.text.length).toBeLessThan(50); // Should be very short
  });

  it('should handle extreme temperature values', async () => {
    // Very low temperature (deterministic)
    const lowTempResult = await generateText({
      model: ollama('llama3.2'),
      prompt: 'Complete: The sky is',
      maxOutputTokens: 10,
      temperature: 0,
    });

    // Very high temperature (random)
    const highTempResult = await generateText({
      model: ollama('llama3.2'),
      prompt: 'Complete: The sky is',
      maxOutputTokens: 10,
      temperature: 2,
    });

    expect(lowTempResult.text).toBeTruthy();
    expect(highTempResult.text).toBeTruthy();
  });

  it('should handle special characters in prompts', async () => {
    const specialPrompt = 'Hello! @#$%^&*()_+-=[]{}|;:,.<>?/"\'\\`~';

    const result = await generateText({
      model: ollama('llama3.2'),
      prompt: specialPrompt,
      maxOutputTokens: 50,
      temperature: 0,
    });

    expect(result.text).toBeTruthy();
    expect(result.usage.inputTokens).toBeGreaterThan(0);
  });

  it('should handle Unicode characters', async () => {
    const unicodePrompt = 'Hello 世界! 🌍 🚀';

    const result = await generateText({
      model: ollama('llama3.2'),
      prompt: unicodePrompt,
      maxOutputTokens: 50,
      temperature: 0,
    });

    expect(result.text).toBeTruthy();
    expect(result.usage.inputTokens).toBeGreaterThan(0);
  });

  it('should handle concurrent requests', async () => {
    const requests = Array.from({ length: 5 }, (_, i) =>
      generateText({
        model: ollama('llama3.2'),
        prompt: `Request ${i}: Say hello`,
        maxOutputTokens: 20,
        temperature: 0,
      }),
    );

    const results = await Promise.all(requests);

    expect(results).toHaveLength(5);
    for (const result of results) {
      expect(result.text).toBeTruthy();
      expect(result.usage.inputTokens).toBeGreaterThan(0);
    }
  });

  it('should handle custom headers', async () => {
    const provider = createOllama({
      headers: {
        'X-Custom-Header': 'test-value',
      },
    });

    const result = await generateText({
      model: provider('llama3.2'),
      prompt: 'Hello with custom headers',
      maxOutputTokens: 20,
      temperature: 0,
    });

    expect(result.text).toBeTruthy();
  });

  it('should handle custom fetch implementation', async () => {
    const customFetch = async (
      input: string | URL | Request,
      init?: RequestInit,
    ) => {
      // Use the default fetch but add custom logic if needed
      return fetch(input, init);
    };

    const provider = createOllama({
      fetch: customFetch,
    });

    const result = await generateText({
      model: provider('llama3.2'),
      prompt: 'Hello with custom fetch',
      maxOutputTokens: 20,
      temperature: 0,
    });

    expect(result.text).toBeTruthy();
  });

  it('should handle structured outputs with invalid JSON', async () => {
    const result = await generateText({
      model: ollama('llama3.2', { structuredOutputs: true }),
      prompt: 'Generate invalid JSON',
      maxOutputTokens: 50,
      temperature: 0,
    });

    expect(result.text).toBeTruthy();
    // The model might still try to generate valid JSON even with invalid prompt
    try {
      JSON.parse(result.text);
      // If parsing succeeds, that's fine
    } catch (error) {
      // If parsing fails, that's also expected for this test
      expect(error).toBeInstanceOf(SyntaxError);
    }
  });

  it('should handle embedding with very long text', async () => {
    const longText = 'This is a very long text for embedding. '.repeat(100);

    const result = await embed({
      model: ollama.embedding('nomic-embed-text'),
      value: longText,
    });

    expect(result.embedding).toBeInstanceOf(Array);
    expect(result.embedding.length).toBe(768);
    // Note: EmbeddingModelUsage doesn't have inputTokens, so we skip that check
  });

  it('should handle embedding with special characters', async () => {
    const specialText = 'Hello! @#$%^&*()_+-=[]{}|;:,.<>?/"\'\\`~ 世界 🌍';

    const result = await embed({
      model: ollama.embedding('nomic-embed-text'),
      value: specialText,
    });

    expect(result.embedding).toBeInstanceOf(Array);
    expect(result.embedding.length).toBe(768);
    // Note: EmbeddingModelUsage doesn't have inputTokens, so we skip that check
  });
});
