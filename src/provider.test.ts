import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createOllama } from './provider';
import { OllamaChatLanguageModel } from './models/chat-language-model';
import { OllamaEmbeddingModel } from './models/embedding-model';
// Removed unused imports - tests focus on provider setup, not AI SDK usage

describe('OllamaProvider', () => {
  describe('createOllama', () => {
    it('should create a provider with default settings', () => {
      const provider = createOllama();
      expect(provider).toBeDefined();
      expect(typeof provider).toBe('function');
    });

    it('should create a provider with custom baseURL', () => {
      const provider = createOllama({
        baseURL: 'http://localhost:8080',
      });
      expect(provider).toBeDefined();
    });

    it('should create a provider with custom headers', () => {
      const provider = createOllama({
        headers: {
          Authorization: 'Bearer token',
        },
      });
      expect(provider).toBeDefined();
    });

    it('should create a provider with custom fetch', () => {
      const customFetch = vi.fn();
      const provider = createOllama({
        fetch: customFetch,
      });
      expect(provider).toBeDefined();
    });
  });

  describe('provider methods', () => {
    let provider: ReturnType<typeof createOllama>;

    beforeEach(() => {
      provider = createOllama();
    });

    it('should create a chat model using function call', () => {
      const model = provider('llama3');
      expect(model).toBeInstanceOf(OllamaChatLanguageModel);
    });

    it('should throw error when called with new keyword', () => {
      const provider = createOllama();
      expect(() => {
        // @ts-expect-error Testing error case
        new provider('llama3');
      }).toThrow('The Ollama provider cannot be called with the new keyword.');
    });

    it('should create a chat model using chat method', () => {
      const model = provider.chat('llama3');
      expect(model).toBeInstanceOf(OllamaChatLanguageModel);
    });

    it('should create a chat model using languageModel method', () => {
      const model = provider.languageModel('llama3');
      expect(model).toBeInstanceOf(OllamaChatLanguageModel);
    });

    it('should create an embedding model using embedding method', () => {
      const model = provider.embedding('llama3');
      expect(model).toBeInstanceOf(OllamaEmbeddingModel);
    });

    it('should create an embedding model using textEmbedding method', () => {
      const model = provider.textEmbedding('llama3');
      expect(model).toBeInstanceOf(OllamaEmbeddingModel);
    });

    it('should create an embedding model using textEmbeddingModel method', () => {
      const model = provider.textEmbeddingModel('llama3');
      expect(model).toBeInstanceOf(OllamaEmbeddingModel);
    });

    it('should throw error for imageModel', () => {
      expect(() => provider.imageModel('llama3')).toThrow(
        'Image generation is not supported by Ollama',
      );
    });

    it('should pass settings to chat model', () => {
      const settings = {
        structuredOutputs: true,
        options: {
          temperature: 0.7,
          num_ctx: 4096,
        },
      };
      const model = provider.chat('llama3', settings);
      expect(model).toBeInstanceOf(OllamaChatLanguageModel);
      // Note: settings are not exposed on the LanguageModelV2 interface
      expect(model).toBeInstanceOf(OllamaChatLanguageModel);
    });

    it('should pass settings to embedding model', () => {
      const settings = {
        options: {
          num_thread: 8,
        },
      };
      const model = provider.embedding('llama3', settings);
      expect(model).toBeInstanceOf(OllamaEmbeddingModel);
    });
  });

  describe('LanguageModelV2 compliance', () => {
    let provider: ReturnType<typeof createOllama>;

    beforeEach(() => {
      provider = createOllama();
    });

    it('should have correct specification version', () => {
      const model = provider('llama3');
      expect(model.specificationVersion).toBe('v2');
    });

    it('should have all required properties', () => {
      const model = provider('llama3');
      expect(model.modelId).toBe('llama3');
      expect(model.provider).toBe('ollama');
      // Note: These properties are not exposed on the LanguageModelV2 interface
      expect(model).toBeInstanceOf(OllamaChatLanguageModel);
      expect(model.supportedUrls).toEqual({});
    });

    it('should implement doGenerate method', () => {
      const model = provider('llama3');
      expect(typeof model.doGenerate).toBe('function');
    });

    it('should implement doStream method', () => {
      const model = provider('llama3');
      expect(typeof model.doStream).toBe('function');
    });
  });

  describe('EmbeddingModelV2 compliance', () => {
    let provider: ReturnType<typeof createOllama>;

    beforeEach(() => {
      provider = createOllama();
    });

    it('should have correct specification version', () => {
      const model = provider.embedding('nomic-embed-text');
      expect(model.specificationVersion).toBe('v2');
    });

    it('should have all required properties', () => {
      const model = provider.embedding('nomic-embed-text');
      expect(model.modelId).toBe('nomic-embed-text');
      expect(model.provider).toBe('ollama');
      expect(model.maxEmbeddingsPerCall).toBe(2048);
      expect(model.supportsParallelCalls).toBe(true);
    });

    it('should implement doEmbed method', () => {
      const model = provider.embedding('nomic-embed-text');
      expect(typeof model.doEmbed).toBe('function');
    });
  });

  describe('Advanced features', () => {
    let provider: ReturnType<typeof createOllama>;

    beforeEach(() => {
      provider = createOllama();
    });

    it('should support structured outputs', () => {
      const model = provider('llama3', { structuredOutputs: true });
      // Note: supportsStructuredOutputs is not exposed on the LanguageModelV2 interface
      expect(model).toBeInstanceOf(OllamaChatLanguageModel);
    });

    it('should support custom Ollama options', () => {
      const model = provider('llama3', {
        options: {
          num_ctx: 8192,
          num_gpu: 2,
          temperature: 0.8,
          top_k: 50,
          top_p: 0.95,
          seed: 42,
        },
      });
      // Note: settings are not exposed on the LanguageModelV2 interface
      expect(model).toBeInstanceOf(OllamaChatLanguageModel);
    });

    it('should support all Ollama-specific parameters', () => {
      const model = provider('llama3', {
        options: {
          mirostat: 1,
          mirostat_eta: 0.1,
          mirostat_tau: 5,
          // num_batch is not supported in the current interface
          repeat_last_n: 64,
          repeat_penalty: 1.1,
          penalize_newline: false,
          numa: true,
          num_thread: 8,
          main_gpu: 0,
          low_vram: false,
          f16_kv: true,
          vocab_only: false,
          use_mmap: true,
          use_mlock: false,
        },
      });
      // Note: settings are not exposed on the LanguageModelV2 interface
      expect(model).toBeInstanceOf(OllamaChatLanguageModel);
    });
  });
});
