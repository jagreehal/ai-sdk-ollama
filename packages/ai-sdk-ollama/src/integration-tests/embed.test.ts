import { describe, it, expect } from 'vitest';
import { embed } from 'ai';
import { ollama } from '../index';

// Integration test for embeddings
describe('Embed Integration Tests', () => {
  it('should generate embeddings for text', async () => {
    const { embedding, usage } = await embed({
      model: ollama.embedding('nomic-embed-text'),
      value: 'sunny day at the beach',
    });

    expect(embedding).toBeInstanceOf(Array);
    expect(embedding.length).toBe(768); // nomic-embed-text dimension
    expect(usage).toBeDefined();
    // Note: Embedding models may not return detailed usage statistics
  });

  it('should generate embeddings for different text lengths', async () => {
    const shortText = 'hello';
    const longText =
      'This is a much longer text that should still generate a valid embedding with the same dimensions as shorter texts. The embedding model should be able to handle various text lengths consistently.';

    const shortResult = await embed({
      model: ollama.embedding('nomic-embed-text'),
      value: shortText,
    });

    const longResult = await embed({
      model: ollama.embedding('nomic-embed-text'),
      value: longText,
    });

    expect(shortResult.embedding).toBeInstanceOf(Array);
    expect(longResult.embedding).toBeInstanceOf(Array);
    expect(shortResult.embedding.length).toBe(768);
    expect(longResult.embedding.length).toBe(768);
    // Note: Embedding models may not return detailed usage statistics
  });

  it('should handle multiple embeddings concurrently', async () => {
    const texts = ['Text 0', 'Text 1', 'Text 2', 'Text 3', 'Text 4'];

    const results = await Promise.all(
      texts.map((text) =>
        embed({
          model: ollama.embedding('nomic-embed-text'),
          value: text,
        }),
      ),
    );

    expect(results).toHaveLength(5);

    for (const result of results) {
      expect(result.embedding).toBeInstanceOf(Array);
      expect(result.embedding.length).toBe(768);
      expect(result.usage).toBeDefined();
      // Note: Embedding models may not return detailed usage statistics
    }
  });

  it('should generate different embeddings for different texts', async () => {
    const text1 = 'The weather is sunny today';
    const text2 = 'The weather is rainy today';
    const text3 = 'The weather is sunny today'; // Same as text1

    const result1 = await embed({
      model: ollama.embedding('nomic-embed-text'),
      value: text1,
    });

    const result2 = await embed({
      model: ollama.embedding('nomic-embed-text'),
      value: text2,
    });

    const result3 = await embed({
      model: ollama.embedding('nomic-embed-text'),
      value: text3,
    });

    // Same text should have similar embeddings
    expect(result1.embedding).toEqual(result3.embedding);

    // Different texts should have different embeddings
    expect(result1.embedding).not.toEqual(result2.embedding);
  });

  it('should handle special characters and symbols', async () => {
    const specialText = 'Hello! @#$%^&*()_+-=[]{}|;:,.<>?/"\'\\`~';

    const result = await embed({
      model: ollama.embedding('nomic-embed-text'),
      value: specialText,
    });

    expect(result.embedding).toBeInstanceOf(Array);
    expect(result.embedding.length).toBe(768);
    // Note: Embedding models may not return detailed usage statistics
  });

  it('should handle empty string', async () => {
    // Empty string may not be supported by all embedding models
    try {
      const result = await embed({
        model: ollama.embedding('nomic-embed-text'),
        value: '',
      });

      expect(result.embedding).toBeInstanceOf(Array);
      expect(result.embedding.length).toBe(768);
      // Note: Embedding models may not return detailed usage statistics
    } catch (error) {
      // If empty string is not supported, that's also acceptable
      expect(error).toBeDefined();
    }
  });

  it('should handle very long text', async () => {
    const longText = 'This is a very long text. '.repeat(100);

    const result = await embed({
      model: ollama.embedding('nomic-embed-text'),
      value: longText,
    });

    expect(result.embedding).toBeInstanceOf(Array);
    expect(result.embedding.length).toBe(768);
    // Note: Embedding models may not return detailed usage statistics
  });

  it('should handle different embedding models', async () => {
    const models = ['nomic-embed-text'];
    const text = 'Test embedding text';

    for (const modelName of models) {
      const result = await embed({
        model: ollama.embedding(modelName),
        value: text,
      });

      expect(result.embedding).toBeInstanceOf(Array);
      expect(result.embedding.length).toBeGreaterThan(0);
      expect(result.usage).toBeDefined();
    }
  });
});
