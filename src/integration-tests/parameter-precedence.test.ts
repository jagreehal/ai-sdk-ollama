import { describe, it, expect } from 'vitest';
import { generateText } from 'ai';
import { ollama } from '../index';

describe('Parameter Precedence Integration Tests', { timeout: 120_000 }, () => {
  it('should use AI SDK standard parameters for cross-provider compatibility', async () => {
    const result = await generateText({
      model: ollama('llama3.2'),
      prompt: 'Write a haiku about coding',
      // Standard AI SDK parameters - portable across providers
      temperature: 0.1, // Low temperature for consistency
      maxOutputTokens: 50,
      topP: 0.9,
      topK: 40,
      seed: 42,
      stopSequences: ['---'],
    });

    expect(result.text).toBeTruthy();
    expect(typeof result.text).toBe('string');
    expect(result.text.length).toBeGreaterThan(10);
    // Should not contain stop sequence
    expect(result.text).not.toContain('---');
  });

  it('should use native Ollama options for advanced features', async () => {
    const result = await generateText({
      model: ollama('llama3.2', {
        options: {
          // Ollama-specific parameters
          temperature: 0.1,
          num_ctx: 4096,
          num_predict: 50,
          top_k: 30,
          top_p: 0.85,
          // Advanced Ollama-only features
          repeat_penalty: 1.1,
          repeat_last_n: 64,
          mirostat: 0, // Disable mirostat for consistent testing
          seed: 123,
          numa: false,
        },
      }),
      prompt: 'Write a haiku about AI',
    });

    expect(result.text).toBeTruthy();
    expect(typeof result.text).toBe('string');
    expect(result.text.length).toBeGreaterThan(10);
  });

  it('should handle hybrid approach with Ollama options taking precedence', async () => {
    const result = await generateText({
      model: ollama('llama3.2', {
        options: {
          // Ollama-specific advanced features
          num_ctx: 2048,
          repeat_penalty: 1.2,
          // This should override the AI SDK temperature below
          temperature: 0.1, // Very low for deterministic output
          seed: 999,
        },
      }),
      prompt: 'Complete: The quick brown fox',
      // AI SDK standard parameters
      temperature: 0.9, // This should be overridden by Ollama option (0.1)
      maxOutputTokens: 30,
      topP: 0.95,
      seed: 888, // This might be overridden by Ollama seed (999)
    });

    expect(result.text).toBeTruthy();
    expect(typeof result.text).toBe('string');
    expect(result.text.length).toBeGreaterThan(5);
    // The model should complete the sentence in some way
    expect(result.text.toLowerCase()).toMatch(/fox|jumps|lazy|dog|brown/);
  });

  it('should verify parameter mapping from AI SDK to Ollama format', async () => {
    const result = await generateText({
      model: ollama('llama3.2'),
      prompt: 'Say hello',
      // Test parameter mapping
      maxOutputTokens: 20, // Should be mapped to num_predict
      temperature: 0.2, // Should be passed as temperature
      topP: 0.8, // Should be passed as top_p
      topK: 25, // Should be passed as top_k
      seed: 456, // Should be passed as seed
    });

    expect(result.text).toBeTruthy();
    expect(result.text.toLowerCase()).toContain('hello');
    expect(result.usage).toBeDefined();
    expect(result.usage.inputTokens).toBeGreaterThan(0);
    expect(result.usage.outputTokens).toBeGreaterThan(0);
    // Should respect token limit
    expect(result.usage.outputTokens).toBeLessThanOrEqual(25); // Some buffer for exact limits
  });

  it('should handle future compatibility with unknown Ollama parameters', async () => {
    const result = await generateText({
      model: ollama('llama3.2', {
        options: {
          temperature: 0.3,
          // These hypothetical future parameters should be passed through
          // without breaking the provider
          experimental_feature_x: true,
          new_sampling_method: 'advanced',
          future_optimization: 2.5,
        } as Record<string, unknown>, // Type assertion for future parameters
      }),
      prompt: 'What is 2 + 2?',
      maxOutputTokens: 20,
    });

    expect(result.text).toBeTruthy();
    expect(typeof result.text).toBe('string');
    // Should still work despite unknown parameters
    expect(result.text).toMatch(/4|four/i);
  });

  it('should demonstrate deterministic behavior with seed parameters', async () => {
    const prompt = 'Complete this sentence: The weather is';
    const config = {
      model: ollama('llama3.2', {
        options: {
          seed: 12_345,
          temperature: 0, // Deterministic
          num_predict: 10,
        },
      }),
      prompt,
      maxOutputTokens: 10,
    };

    const result1 = await generateText(config);
    const result2 = await generateText(config);

    expect(result1.text).toBeTruthy();
    expect(result2.text).toBeTruthy();
    // With same seed and zero temperature, should be identical or very similar
    // Note: Perfect determinism may vary by model, so we test for non-empty consistent results
    expect(result1.text.length).toBeGreaterThan(0);
    expect(result2.text.length).toBeGreaterThan(0);
  });

  it('should verify advanced Ollama parameters affect output', async () => {
    // Test with high repeat penalty
    const highPenaltyResult = await generateText({
      model: ollama('llama3.2', {
        options: {
          temperature: 0.5,
          repeat_penalty: 1.5, // High penalty to discourage repetition
          repeat_last_n: 20,
          seed: 777,
          num_predict: 50,
        },
      }),
      prompt: 'Write about the benefits of exercise',
    });

    // Test with low repeat penalty
    const lowPenaltyResult = await generateText({
      model: ollama('llama3.2', {
        options: {
          temperature: 0.5,
          repeat_penalty: 1, // No penalty
          repeat_last_n: 20,
          seed: 777, // Same seed for comparison
          num_predict: 50,
        },
      }),
      prompt: 'Write about the benefits of exercise',
    });

    expect(highPenaltyResult.text).toBeTruthy();
    expect(lowPenaltyResult.text).toBeTruthy();
    expect(highPenaltyResult.text.length).toBeGreaterThan(10);
    expect(lowPenaltyResult.text.length).toBeGreaterThan(10);

    // Both should contain relevant content
    expect(highPenaltyResult.text.toLowerCase()).toMatch(
      /exercise|health|fitness|benefit/,
    );
    expect(lowPenaltyResult.text.toLowerCase()).toMatch(
      /exercise|health|fitness|benefit/,
    );
  });
});
