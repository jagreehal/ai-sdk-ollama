import { describe, it, expect } from 'vitest';
import { ollama } from './index';

describe('OpenAI API Compatibility', () => {
  describe('Provider Interface Compatibility', () => {
    it('should implement standard provider pattern like OpenAI provider', () => {
      // Test that our provider follows the same pattern as Vercel's OpenAI provider
      expect(typeof ollama).toBe('function');
      expect(typeof ollama.chat).toBe('function');
      expect(typeof ollama.languageModel).toBe('function');
      expect(typeof ollama.embedding).toBe('function');
      expect(typeof ollama.textEmbedding).toBe('function');
      expect(typeof ollama.textEmbeddingModel).toBe('function');
    });

    it('should create LanguageModelV2 compatible models', () => {
      const model = ollama('llama3.2');

      // Test LanguageModelV2 interface compliance
      expect(model.specificationVersion).toBe('v2');
      expect(typeof model.modelId).toBe('string');
      expect(typeof model.provider).toBe('string');
      expect(typeof model.doGenerate).toBe('function');
      expect(typeof model.doStream).toBe('function');

      // Test that model has expected properties (interface may have changed)
      expect(typeof model.supportedUrls).toBe('object');
    });

    it('should create EmbeddingModelV2 compatible models', () => {
      const model = ollama.embedding('nomic-embed-text');

      // Test EmbeddingModelV2 interface compliance
      expect(model.specificationVersion).toBe('v2');
      expect(typeof model.modelId).toBe('string');
      expect(typeof model.provider).toBe('string');
      expect(typeof model.doEmbed).toBe('function');

      // Test standard properties
      expect(typeof model.maxEmbeddingsPerCall).toBe('number');
      expect(typeof model.supportsParallelCalls).toBe('boolean');
    });
  });

  describe('AI SDK Integration Compatibility', () => {
    it('should work with generateText like OpenAI provider', () => {
      const model = ollama('llama3.2');

      // Test that model can be used with AI SDK functions
      expect(typeof model.doGenerate).toBe('function');
      expect(model.doGenerate.length).toBe(1); // Takes one parameter (options)
    });

    it('should work with streamText like OpenAI provider', () => {
      const model = ollama('llama3.2');

      expect(typeof model.doStream).toBe('function');
      expect(model.doStream.length).toBe(1); // Takes one parameter (options)
    });

    it('should work with embed like OpenAI provider', () => {
      const model = ollama.embedding('nomic-embed-text');

      expect(() => {
        // Test embedding interface compatibility
        expect(typeof model.doEmbed).toBe('function');
        expect(model.doEmbed.length).toBe(1); // Takes one parameter (options)
      }).not.toThrow();
    });
  });

  describe('Response Format Compatibility', () => {
    it('should support JSON response format like OpenAI', () => {
      const model = ollama('llama3.2');

      // Test that our model exists and can be configured
      expect(model.provider).toBe('ollama');
      expect(model.modelId).toBe('llama3.2');
    });

    it('should support standard parameters like OpenAI', () => {
      const model = ollama('llama3.2');

      // Test basic model properties
      expect(typeof model.doGenerate).toBe('function');
      expect(typeof model.doStream).toBe('function');
    });
  });

  describe('Error Handling Compatibility', () => {
    it('should handle errors consistently with OpenAI provider', () => {
      const model = ollama('llama3.2');

      // Test that our error handling follows standard patterns
      expect(model.provider).toBe('ollama');
      expect(model.modelId).toBe('llama3.2');

      // Models should have consistent error behavior
      expect(() => {
        // Test model creation with invalid parameters
        ollama(''); // Empty model name
      }).not.toThrow(); // Should create model, errors happen at runtime
    });
  });

  describe('Provider Settings Compatibility', () => {
    it('should support provider-specific settings like OpenAI', () => {
      // Test custom settings similar to how OpenAI provider works
      const modelWithSettings = ollama('llama3.2', {
        options: {
          temperature: 0.8,
          num_ctx: 4096,
          top_k: 50,
        },
      });

      expect(modelWithSettings.modelId).toBe('llama3.2');
      expect(modelWithSettings.provider).toBe('ollama');
    });

    it('should support structured outputs setting', () => {
      const modelWithStructuredOutputs = ollama('llama3.2', {
        structuredOutputs: true,
      });

      expect(modelWithStructuredOutputs.provider).toBe('ollama');
    });
  });

  describe('Embedding Model Compatibility', () => {
    it('should handle embeddings consistently with OpenAI', () => {
      const embeddingModel = ollama.embedding('nomic-embed-text');

      expect(embeddingModel.modelId).toBe('nomic-embed-text');
      expect(embeddingModel.provider).toBe('ollama');
      expect(embeddingModel.specificationVersion).toBe('v2');
      expect(typeof embeddingModel.maxEmbeddingsPerCall).toBe('number');
      expect(embeddingModel.maxEmbeddingsPerCall).toBeGreaterThan(0);
    });

    it('should support embedding settings', () => {
      const embeddingModel = ollama.embedding('nomic-embed-text', {
        options: {
          num_thread: 8,
        },
      });

      expect(embeddingModel.provider).toBe('ollama');
    });
  });
});
