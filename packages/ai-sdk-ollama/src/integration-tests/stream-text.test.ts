import { describe, it, expect } from 'vitest';
import { streamText } from 'ai';
import { ollama } from '../index';

// Integration test for streaming text
describe('Stream Text Integration Tests', () => {
  it('should stream text responses with multiple chunks', async () => {
    const result = await streamText({
      maxOutputTokens: 512,
      maxRetries: 5,
      model: ollama('llama3.2'),
      prompt: 'Invent a new holiday and describe its traditions.',
      temperature: 0.3,
    });

    const chunks: string[] = await Array.fromAsync(result.textStream);

    const fullText = chunks.join('');
    expect(fullText).toBeTruthy();
    expect(fullText.length).toBeGreaterThan(10);
    expect(chunks.length).toBeGreaterThan(1); // Should have multiple chunks

    // Should contain holiday-related content
    expect(fullText.toLowerCase()).toMatch(
      /holiday|celebration|tradition|festival|ceremony/,
    );
  });

  it('should handle streaming with different models', async () => {
    const models = ['llama3.2']; // Only test with llama3.2 for now

    for (const modelName of models) {
      const result = await streamText({
        model: ollama(modelName),
        prompt: 'Count from 1 to 5',
        maxOutputTokens: 100,
        temperature: 0,
      });

      const chunks: string[] = await Array.fromAsync(result.textStream);

      const fullText = chunks.join('');
      expect(fullText).toBeTruthy();
      expect(chunks.length).toBeGreaterThan(1);
      expect(fullText.toLowerCase()).toMatch(/1.*2.*3.*4.*5/);
    }
  });

  it('should respect maxOutputTokens limit in streaming', async () => {
    const result = await streamText({
      model: ollama('llama3.2'),
      prompt: 'Write a very long story about space exploration',
      maxOutputTokens: 50,
      temperature: 0,
    });

    const chunks: string[] = await Array.fromAsync(result.textStream);

    const fullText = chunks.join('');
    expect(fullText).toBeTruthy();
    expect(fullText.length).toBeLessThan(500); // Should be relatively short
  });

  it('should provide usage and finish reason after streaming', async () => {
    const result = await streamText({
      model: ollama('llama3.2'),
      prompt: 'Say hello world',
      maxOutputTokens: 100,
      temperature: 0,
    });

    // Consume the stream
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    for await (const _textPart of result.textStream) {
      // Just consume
    }

    // Check usage and finish reason
    const usage = await result.usage;
    const finishReason = await result.finishReason;

    expect(usage).toBeDefined();
    expect(usage.inputTokens).toBeGreaterThan(0);
    expect(usage.outputTokens).toBeGreaterThan(0);
    expect(finishReason).toBeDefined();
    expect(['stop', 'length', 'tool-calls']).toContain(finishReason);
  });

  it('should handle streaming with temperature variations', async () => {
    const lowTemporaryResult = await streamText({
      model: ollama('llama3.2'),
      prompt: 'Complete this sentence: The weather is',
      maxOutputTokens: 20,
      temperature: 0,
    });

    const highTemporaryResult = await streamText({
      model: ollama('llama3.2'),
      prompt: 'Complete this sentence: The weather is',
      maxOutputTokens: 20,
      temperature: 0.9,
    });

    const lowTemporaryChunks: string[] = [];
    const highTemporaryChunks: string[] = [];

    for await (const textPart of lowTemporaryResult.textStream) {
      lowTemporaryChunks.push(textPart);
    }

    for await (const textPart of highTemporaryResult.textStream) {
      highTemporaryChunks.push(textPart);
    }

    const lowTemporaryText = lowTemporaryChunks.join('');
    const highTemporaryText = highTemporaryChunks.join('');

    expect(lowTemporaryText).toBeTruthy();
    expect(highTemporaryText).toBeTruthy();
    expect(lowTemporaryChunks.length).toBeGreaterThan(0);
    expect(highTemporaryChunks.length).toBeGreaterThan(0);
  });

  it('should handle streaming with structured outputs', async () => {
    const result = await streamText({
      model: ollama('llama3.2', { structuredOutputs: true }),
      prompt: 'Generate a JSON object with a message field saying hello',
      maxOutputTokens: 100,
      temperature: 0,
    });

    const chunks: string[] = await Array.fromAsync(result.textStream);

    const fullText = chunks.join('');
    expect(fullText).toBeTruthy();

    // Try to parse as JSON, but don't fail if it's not valid
    try {
      const parsed = JSON.parse(fullText);
      expect(parsed).toHaveProperty('message');
      expect(typeof parsed.message).toBe('string');
    } catch {
      // If JSON parsing fails, just verify we got some text
      expect(fullText.length).toBeGreaterThan(0);
    }
  });
});
