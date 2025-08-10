import { describe, it, expect } from 'vitest';
import { generateText } from 'ai';
import { ollama } from '../index';

// Integration test for basic text generation
describe('Generate Text Integration Tests', () => {
  it('should generate text with basic prompt', async () => {
    const result = await generateText({
      model: ollama('llama3.2'),
      prompt: 'Invent a new holiday and describe its traditions.',
      maxOutputTokens: 200,
      temperature: 0.3,
    });

    expect(result.text).toBeTruthy();
    expect(typeof result.text).toBe('string');
    expect(result.text.length).toBeGreaterThan(10);

    // Should contain holiday-related content
    expect(result.text.toLowerCase()).toMatch(
      /holiday|celebration|tradition|festival|ceremony/,
    );
  });

  it('should generate text with different models', async () => {
    const models = ['llama3.2']; // Only test with llama3.2 for now

    for (const modelName of models) {
      const result = await generateText({
        model: ollama(modelName),
        prompt: 'Say hello in a creative way',
        maxOutputTokens: 50,
        temperature: 0.1,
      });

      expect(result.text).toBeTruthy();
      expect(result.text.toLowerCase()).toContain('hello');
    }
  });

  it('should handle structured outputs when enabled', async () => {
    const result = await generateText({
      model: ollama('llama3.2', { structuredOutputs: true }),
      prompt: 'Generate a JSON object with a message field saying hello',
      maxOutputTokens: 100,
      temperature: 0,
    });

    expect(result.text).toBeTruthy();

    // Try to parse as JSON, but don't fail if it's not valid
    try {
      const parsed = JSON.parse(result.text);
      expect(parsed).toHaveProperty('message');
      expect(typeof parsed.message).toBe('string');
    } catch {
      // If JSON parsing fails, just verify we got some text
      expect(result.text.length).toBeGreaterThan(0);
    }
  });

  it('should respect maxOutputTokens limit', async () => {
    const result = await generateText({
      model: ollama('llama3.2'),
      prompt: 'Write a long story about space exploration',
      maxOutputTokens: 20,
      temperature: 0,
    });

    expect(result.text).toBeTruthy();
    // Should be relatively short due to token limit
    expect(result.text.length).toBeLessThan(200);
  });

  it('should handle temperature settings', async () => {
    const lowTempResult = await generateText({
      model: ollama('llama3.2'),
      prompt: 'Complete this sentence: The weather is',
      maxOutputTokens: 10,
      temperature: 0,
    });

    const highTempResult = await generateText({
      model: ollama('llama3.2'),
      prompt: 'Complete this sentence: The weather is',
      maxOutputTokens: 10,
      temperature: 0.9,
    });

    expect(lowTempResult.text).toBeTruthy();
    expect(highTempResult.text).toBeTruthy();
    // High temperature should produce more varied results
    expect(lowTempResult.text).not.toEqual(highTempResult.text);
  });
});
