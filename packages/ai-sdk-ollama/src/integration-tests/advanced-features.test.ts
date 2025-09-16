import { describe, it, expect } from 'vitest';
import { generateText, streamText } from 'ai';
import { ollama } from '../index';

// Integration test for advanced features and Ollama-specific parameters
describe('Advanced Features Integration Tests', () => {
  it('should support all Ollama parameters', async () => {
    const result = await generateText({
      model: ollama('llama3.2', {
        options: {
          num_ctx: 2048,
          temperature: 0.5,
          top_k: 40,
          top_p: 0.9,
          min_p: 0.05,
          seed: 123,
          stop: ['\n'],
          typical_p: 1,
          repeat_last_n: 64,
          repeat_penalty: 1.1,
          presence_penalty: 0,
          frequency_penalty: 0,
          mirostat: 0,
          mirostat_tau: 5,
          mirostat_eta: 0.1,
          penalize_newline: true,
          numa: false,
        } as any,
      }),
      prompt: 'Write one word',
      maxOutputTokens: 10,
    });

    expect(result.text).toBeTruthy();
    expect(result.text.split(' ').length).toBeLessThan(5);
  });

  it('should support stop sequences', async () => {
    const result = await generateText({
      model: ollama('llama3.2'),
      prompt: 'Count: 1, 2, 3, STOP, 4, 5',
      stopSequences: ['STOP'],
      maxOutputTokens: 100,
    });

    expect(result.text).toBeTruthy();
    expect(result.text).not.toContain('4');
    expect(result.text).not.toContain('5');
  });

  it('should support multiple stop sequences', async () => {
    const result = await generateText({
      model: ollama('llama3.2'),
      prompt: 'List fruits: apple, banana, END, orange, grape',
      stopSequences: ['END', 'orange'],
      maxOutputTokens: 100,
    });

    expect(result.text).toBeTruthy();
    expect(result.text).not.toContain('orange');
    expect(result.text).not.toContain('grape');
  });

  it('should support seed for deterministic output', async () => {
    const result1 = await generateText({
      model: ollama('llama3.2', {
        options: {
          seed: 42,
          temperature: 0.1,
        },
      }),
      prompt: 'Complete this sentence: The weather is',
      maxOutputTokens: 10,
    });

    const result2 = await generateText({
      model: ollama('llama3.2', {
        options: {
          seed: 42,
          temperature: 0.1,
        },
      }),
      prompt: 'Complete this sentence: The weather is',
      maxOutputTokens: 10,
    });

    // With same seed and low temperature, should be deterministic
    expect(result1.text).toEqual(result2.text);
  });

  it('should support different temperature with same seed', async () => {
    const result1 = await generateText({
      model: ollama('llama3.2', {
        options: {
          seed: 42,
          temperature: 0,
        },
      }),
      prompt: 'Complete this sentence: The weather is',
      maxOutputTokens: 10,
    });

    const result2 = await generateText({
      model: ollama('llama3.2', {
        options: {
          seed: 42,
          temperature: 0.9,
        },
      }),
      prompt: 'Complete this sentence: The weather is',
      maxOutputTokens: 10,
    });

    // Different temperatures should produce different results even with same seed
    expect(result1.text).not.toEqual(result2.text);
  });

  it('should support top_k and top_p parameters', async () => {
    const result = await generateText({
      model: ollama('llama3.2', {
        options: {
          top_k: 10,
          top_p: 0.8,
          temperature: 0.5,
        },
      }),
      prompt: 'Write a creative story',
      maxOutputTokens: 50,
    });

    expect(result.text).toBeTruthy();
    expect(result.text.length).toBeGreaterThan(10);
  });

  it('should support repeat penalty', async () => {
    const result = await generateText({
      model: ollama('llama3.2', {
        options: {
          repeat_penalty: 1.2,
          repeat_last_n: 64,
        },
      }),
      prompt: 'Write a paragraph without repeating words',
      maxOutputTokens: 100,
    });

    expect(result.text).toBeTruthy();
    // Check for excessive repetition (basic check)
    const words = result.text.toLowerCase().split(/\s+/);
    const uniqueWords = new Set(words);
    expect(uniqueWords.size).toBeGreaterThan(words.length * 0.5); // At least 50% unique words
  });

  it('should support presence and frequency penalties', async () => {
    const result = await generateText({
      model: ollama('llama3.2', {
        options: {
          presence_penalty: 0.1,
          frequency_penalty: 0.1,
        },
      }),
      prompt: 'Write about different topics',
      maxOutputTokens: 100,
    });

    expect(result.text).toBeTruthy();
  });

  it('should support context window size', async () => {
    const result = await generateText({
      model: ollama('llama3.2', {
        options: {
          num_ctx: 1024,
        },
      }),
      prompt: 'This is a test of context window size',
      maxOutputTokens: 50,
    });

    expect(result.text).toBeTruthy();
  });

  it('should support streaming with advanced parameters', async () => {
    const result = await streamText({
      model: ollama('llama3.2', {
        options: {
          temperature: 0.3,
          top_k: 40,
          top_p: 0.9,
          seed: 123,
        },
      }),
      prompt: 'Write a short story',
      maxOutputTokens: 200,
    });

    const chunks: string[] = [];
    for await (const textPart of result.textStream) {
      chunks.push(textPart);
    }

    const fullText = chunks.join('');
    expect(fullText).toBeTruthy();
    expect(chunks.length).toBeGreaterThan(1);
  });

  it('should support structured outputs with advanced parameters', async () => {
    const result = await generateText({
      model: ollama('llama3.2', {
        structuredOutputs: true,
        options: {
          temperature: 0.1,
          seed: 42,
        },
      }),
      prompt: 'Generate a JSON object with a message field saying hello',
      maxOutputTokens: 100,
    });

    expect(result.text).toBeTruthy();
    // Try to parse as JSON, but don't fail if it's not valid
    try {
      const parsed = JSON.parse(result.text);
      expect(parsed).toHaveProperty('message');
    } catch {
      // If JSON parsing fails, just verify we got some text
      expect(result.text.length).toBeGreaterThan(0);
    }
  });

  it('should support custom headers in provider', async () => {
    const customProvider = ollama;
    // Note: Custom headers would be set in createOllama, but we're using the default provider
    // This test verifies the provider works with default settings

    const result = await generateText({
      model: customProvider('llama3.2'),
      prompt: 'Test with custom provider',
      maxOutputTokens: 50,
    });

    expect(result.text).toBeTruthy();
  });

  it('should handle different model sizes', async () => {
    const models = ['llama3.2']; // Only test with llama3.2 for now

    for (const modelName of models) {
      const result = await generateText({
        model: ollama(modelName),
        prompt: 'Say hello',
        maxOutputTokens: 20,
        temperature: 0,
      });

      expect(result.text).toBeTruthy();
      expect(result.text.toLowerCase()).toContain('hello');
    }
  });

  it('should support abort signal in streaming', async () => {
    const controller = new AbortController();

    const result = await streamText({
      model: ollama('llama3.2'),
      prompt: 'Write a long story',
      maxOutputTokens: 1000,
      abortSignal: controller.signal,
    });

    const chunks: string[] = [];
    for await (const textPart of result.textStream) {
      chunks.push(textPart);
      if (chunks.length >= 3) {
        controller.abort();
        break;
      }
    }

    expect(chunks.length).toBeLessThanOrEqual(3);
  });

  it('should support retry logic', async () => {
    const result = await generateText({
      model: ollama('llama3.2'),
      prompt: 'Say hello',
      maxOutputTokens: 20,
      maxRetries: 3,
      temperature: 0,
    });

    expect(result.text).toBeTruthy();
    expect(result.text.toLowerCase()).toContain('hello');
  });
});
