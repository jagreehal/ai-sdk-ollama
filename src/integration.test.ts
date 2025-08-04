import { describe, it, expect } from 'vitest';
import { ollama, createOllama } from './index';
import { generateText, streamText, embed, generateObject } from 'ai';
import { z } from 'zod';

// Integration tests with real Ollama models
// Run these tests only when Ollama is running locally
describe.skipIf(!process.env.RUN_INTEGRATION_TESTS)('Ollama Integration Tests', () => {
  describe('Text Generation', () => {
    it('should generate text with llama3.2', async () => {
      const { text, usage } = await generateText({
        model: ollama('llama3.2'),
        prompt: 'Count from 1 to 3',
        maxOutputTokens: 50,
        temperature: 0,
      });

      expect(text).toBeTruthy();
      expect(text.toLowerCase()).toMatch(/1.*2.*3/);
      expect(usage.inputTokens).toBeGreaterThan(0);
      expect(usage.outputTokens).toBeGreaterThan(0);
    });

    it('should generate text with custom settings', async () => {
      const { text } = await generateText({
        model: ollama('llama3.2', {
          options: {
            temperature: 0.1,
            top_k: 10,
            seed: 42,
          },
        }),
        prompt: 'Say hello',
        maxOutputTokens: 10,
      });

      expect(text).toBeTruthy();
      expect(text.toLowerCase()).toContain('hello');
    });

    it('should handle different models', async () => {
      const models = ['llama3.2', 'phi4-mini', 'qwen2.5-coder'];
      
      for (const modelName of models) {
        const { text } = await generateText({
          model: ollama(modelName),
          prompt: 'Reply with OK',
          maxOutputTokens: 10,
          temperature: 0,
        });
        
        expect(text).toBeTruthy();
      }
    });
  });

  describe('Streaming', () => {
    it('should stream text responses', async () => {
      const { textStream } = await streamText({
        model: ollama('llama3.2'),
        prompt: 'Count from 1 to 5',
        maxOutputTokens: 100,
      });

      const chunks: string[] = [];
      for await (const chunk of textStream) {
        chunks.push(chunk);
      }

      const fullText = chunks.join('');
      expect(fullText).toBeTruthy();
      expect(chunks.length).toBeGreaterThan(1); // Should have multiple chunks
    });

    it('should stream with abort signal', async () => {
      const controller = new AbortController();
      
      const { textStream } = await streamText({
        model: ollama('llama3.2'),
        prompt: 'Write a long story',
        maxOutputTokens: 1000,
        abortSignal: controller.signal,
      });

      const chunks: string[] = [];
      for await (const chunk of textStream) {
        chunks.push(chunk);
        if (chunks.length >= 3) {
          controller.abort();
          break;
        }
      }

      expect(chunks.length).toBeLessThanOrEqual(3);
    });
  });

  describe('Embeddings', () => {
    it('should generate embeddings', async () => {
      const { embedding } = await embed({
        model: ollama.embedding('nomic-embed-text'),
        value: 'Hello world',
      });

      expect(embedding).toBeInstanceOf(Array);
      expect(embedding.length).toBe(768); // nomic-embed-text dimension
    });

    it('should handle multiple embeddings', async () => {
      const results = await Promise.all([
        embed({ model: ollama.embedding('nomic-embed-text'), value: 'Text 0' }),
        embed({ model: ollama.embedding('nomic-embed-text'), value: 'Text 1' }),
        embed({ model: ollama.embedding('nomic-embed-text'), value: 'Text 2' }),
      ]);

      expect(results).toHaveLength(3);
      for (const result of results) {
        expect(result.embedding).toBeInstanceOf(Array);
        expect(result.embedding.length).toBe(768);
      }
    });
  });

  describe('Structured Output', () => {
    it('should generate JSON objects', async () => {
      const { object } = await generateObject({
        model: ollama('llama3.2'),
        schema: z.object({
          name: z.string(),
          age: z.number(),
          city: z.string(),
        }),
        prompt: 'Generate a person with name John, age 30, living in New York',
      });

      expect(object.name).toBeTruthy();
      expect(typeof object.age).toBe('number');
      expect(object.city).toBeTruthy();
    });

    it('should generate arrays', async () => {
      const { object } = await generateObject({
        model: ollama('llama3.2'),
        schema: z.object({
          colors: z.array(z.string()),
        }),
        prompt: 'Generate an object with a colors array containing red, green, and blue',
      });

      expect(Array.isArray(object.colors)).toBe(true);
      expect(object.colors.length).toBeGreaterThan(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle non-existent model', async () => {
      await expect(
        generateText({
          model: ollama('non-existent-model'),
          prompt: 'Hello',
        })
      ).rejects.toThrow(/not found/);
    });

    it('should handle network errors', async () => {
      const provider = createOllama({ baseURL: 'http://127.0.0.1:99999' });
      
      await expect(
        generateText({
          model: provider('llama3.2'),
          prompt: 'Hello',
        })
      ).rejects.toThrow();
    });
  });

  describe('Advanced Features', () => {
    it('should support JSON response format', async () => {
      const { text } = await generateText({
        model: ollama('llama3.2', { structuredOutputs: true }),
        prompt: 'Generate a JSON object with a message field saying hello',
      });

      expect(() => JSON.parse(text)).not.toThrow();
      const parsed = JSON.parse(text);
      expect(parsed).toHaveProperty('message');
    });

    it('should support stop sequences', async () => {
      const { text } = await generateText({
        model: ollama('llama3.2'),
        prompt: 'Count: 1, 2, 3, STOP, 4, 5',
        stopSequences: ['STOP'],
      });

      expect(text).not.toContain('4');
      expect(text).not.toContain('5');
    });

    it('should support all Ollama parameters', async () => {
      const { text } = await generateText({
        model: ollama('llama3.2', {
          options: {
            num_ctx: 2048,
            temperature: 0.5,
            top_k: 40,
            top_p: 0.9,
            min_p: 0.05,
            seed: 123,
            stop: ['\n'],
            // tfs_z: 1, // Removed as not supported in type definitions
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
          },
        }),
        prompt: 'Write one word',
        maxOutputTokens: 10,
      });

      expect(text).toBeTruthy();
      expect(text.split(' ').length).toBeLessThan(5);
    });
  });
});

// Mock tests that always run
describe('Ollama Provider Unit Tests', () => {
  it('should export ollama provider', () => {
    expect(ollama).toBeDefined();
    expect(typeof ollama).toBe('function');
  });

  it('should have all provider methods', () => {
    expect(ollama.chat).toBeDefined();
    expect(ollama.languageModel).toBeDefined();
    expect(ollama.embedding).toBeDefined();
    expect(ollama.textEmbedding).toBeDefined();
    expect(ollama.textEmbeddingModel).toBeDefined();
    expect(ollama.imageModel).toBeDefined();
  });
});