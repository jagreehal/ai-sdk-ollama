import { describe, it, expect, beforeEach, vi } from 'vitest';
import { OllamaEmbeddingModel } from './embedding-model';
import { OllamaEmbeddingSettings } from '../provider';
import { OllamaError } from '../utils/ollama-error';
import { Ollama } from 'ollama';

// Mock Ollama client
const mockOllamaClient = {
  embed: vi.fn(),
} as unknown as Ollama;

describe('OllamaEmbeddingModel', () => {
  let model: OllamaEmbeddingModel;
  let settings: OllamaEmbeddingSettings;

  beforeEach(() => {
    vi.clearAllMocks();
    settings = {};
    model = new OllamaEmbeddingModel(
      'nomic-embed-text',
      settings,
      { client: mockOllamaClient, provider: 'ollama' }
    );
  });

  describe('initialization', () => {
    it('should initialize with correct properties', () => {
      expect(model.specificationVersion).toBe('v2');
      expect(model.modelId).toBe('nomic-embed-text');
      expect(model.provider).toBe('ollama');
      expect(model.maxEmbeddingsPerCall).toBe(2048);
      expect(model.supportsParallelCalls).toBe(true);
    });
  });

  describe('doEmbed', () => {
    it('should generate embeddings for single value', async () => {
      const mockResponse = {
        embeddings: [[0.1, 0.2, 0.3, 0.4]],
      };

      vi.mocked(mockOllamaClient.embed).mockResolvedValueOnce(mockResponse);

      const result = await model.doEmbed({
        values: ['Hello world'],
      });

      expect(result.embeddings).toHaveLength(1);
      expect(result.embeddings[0]).toEqual([0.1, 0.2, 0.3, 0.4]);

      expect(mockOllamaClient.embed).toHaveBeenCalledWith({
        model: 'nomic-embed-text',
        input: 'Hello world',
        options: undefined,
      });
    });

    it('should generate embeddings for multiple values', async () => {
      const mockResponses = [
        { embeddings: [[0.1, 0.2, 0.3]] },
        { embeddings: [[0.4, 0.5, 0.6]] },
        { embeddings: [[0.7, 0.8, 0.9]] },
      ];

      vi.mocked(mockOllamaClient.embed)
        .mockResolvedValueOnce(mockResponses[0])
        .mockResolvedValueOnce(mockResponses[1])
        .mockResolvedValueOnce(mockResponses[2]);

      const result = await model.doEmbed({
        values: ['First text', 'Second text', 'Third text'],
      });

      expect(result.embeddings).toHaveLength(3);
      expect(result.embeddings[0]).toEqual([0.1, 0.2, 0.3]);
      expect(result.embeddings[1]).toEqual([0.4, 0.5, 0.6]);
      expect(result.embeddings[2]).toEqual([0.7, 0.8, 0.9]);

      expect(mockOllamaClient.embed).toHaveBeenCalledTimes(3);
    });

    it('should handle empty values array', async () => {
      const result = await model.doEmbed({
        values: [],
      });

      expect(result.embeddings).toHaveLength(0);
      expect(mockOllamaClient.embed).not.toHaveBeenCalled();
    });

    it('should throw error for too many values', async () => {
      const largeArray = Array.from({length: 2049}).fill('text');

      await expect(model.doEmbed({
        values: largeArray,
      })).rejects.toThrow(OllamaError);

      await expect(model.doEmbed({
        values: largeArray,
      })).rejects.toThrow('Too many values to embed. Maximum: 2048, Received: 2049');
    });

    it('should handle maximum allowed values', async () => {
      const mockResponse = {
        embeddings: [[0.1, 0.2]],
      };

      vi.mocked(mockOllamaClient.embed).mockResolvedValue(mockResponse);

      const maxArray = Array.from({length: 2048}).fill('text');

      const result = await model.doEmbed({
        values: maxArray,
      });

      expect(result.embeddings).toHaveLength(2048);
      expect(mockOllamaClient.embed).toHaveBeenCalledTimes(2048);
    });

    it('should handle abort signal', async () => {
      const abortController = new AbortController();
      
      vi.mocked(mockOllamaClient.embed).mockImplementation(async () => {
        if (abortController.signal.aborted) {
          throw new Error('Aborted');
        }
        return { embeddings: [[0.1, 0.2]] };
      });

      // Abort immediately
      abortController.abort();

      await expect(model.doEmbed({
        values: ['Hello'],
        abortSignal: abortController.signal,
      })).rejects.toThrow('Aborted');
    });

    it('should handle errors from Ollama client', async () => {
      const error = new Error('Network error');
      vi.mocked(mockOllamaClient.embed).mockRejectedValueOnce(error);

      await expect(model.doEmbed({
        values: ['Hello'],
      })).rejects.toThrow('Network error');
    });

    it('should handle partial failure in batch', async () => {
      vi.mocked(mockOllamaClient.embed)
        .mockResolvedValueOnce({ embeddings: [[0.1, 0.2]] })
        .mockRejectedValueOnce(new Error('Second request failed'));

      await expect(model.doEmbed({
        values: ['First', 'Second'],
      })).rejects.toThrow('Second request failed');
    });

    it('should use custom options from settings', async () => {
      const customSettings: OllamaEmbeddingSettings = {
        options: {
          num_thread: 8,
          num_ctx: 2048,
        },
      };

      const customModel = new OllamaEmbeddingModel(
        'custom-embed',
        customSettings,
        { client: mockOllamaClient, provider: 'ollama' }
      );

      const mockResponse = {
        embeddings: [[0.1, 0.2, 0.3]],
      };

      vi.mocked(mockOllamaClient.embed).mockResolvedValueOnce(mockResponse);

      await customModel.doEmbed({
        values: ['Test text'],
      });

      expect(mockOllamaClient.embed).toHaveBeenCalledWith({
        model: 'custom-embed',
        input: 'Test text',
        options: expect.objectContaining({
          num_thread: 8,
          num_ctx: 2048,
        }),
      });
    });

    it('should handle different embedding dimensions', async () => {
      const mockResponse = {
        embeddings: [[0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8]], // 8-dimensional
      };

      vi.mocked(mockOllamaClient.embed).mockResolvedValueOnce(mockResponse);

      const result = await model.doEmbed({
        values: ['Test'],
      });

      expect(result.embeddings[0]).toHaveLength(8);
      expect(result.embeddings[0]).toEqual([0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8]);
    });

    it('should handle special characters in input', async () => {
      const mockResponse = {
        embeddings: [[0.1, 0.2, 0.3]],
      };

      vi.mocked(mockOllamaClient.embed).mockResolvedValueOnce(mockResponse);

      const specialText = 'Hello 世界! 🌍 emoji & symbols @#$%';

      await model.doEmbed({
        values: [specialText],
      });

      expect(mockOllamaClient.embed).toHaveBeenCalledWith({
        model: 'nomic-embed-text',
        input: specialText,
        options: undefined,
      });
    });

    it('should handle long text input', async () => {
      const mockResponse = {
        embeddings: [[0.1, 0.2, 0.3]],
      };

      vi.mocked(mockOllamaClient.embed).mockResolvedValueOnce(mockResponse);

      const longText = 'A'.repeat(10_000); // Very long text

      await model.doEmbed({
        values: [longText],
      });

      expect(mockOllamaClient.embed).toHaveBeenCalledWith({
        model: 'nomic-embed-text',
        input: longText,
        options: undefined,
      });
    });

    it('should handle empty string input', async () => {
      const mockResponse = {
        embeddings: [[0, 0, 0]],
      };

      vi.mocked(mockOllamaClient.embed).mockResolvedValueOnce(mockResponse);

      const result = await model.doEmbed({
        values: [''],
      });

      expect(result.embeddings).toHaveLength(1);
      expect(result.embeddings[0]).toEqual([0, 0, 0]);
    });
  });

  describe('concurrent embedding requests', () => {
    it('should handle multiple concurrent embed requests', async () => {
      const mockResponse = {
        embeddings: [[0.1, 0.2, 0.3]],
      };

      vi.mocked(mockOllamaClient.embed).mockResolvedValue(mockResponse);

      const promises = [
        model.doEmbed({ values: ['Text 1'] }),
        model.doEmbed({ values: ['Text 2'] }),
        model.doEmbed({ values: ['Text 3'] }),
      ];

      const results = await Promise.all(promises);

      expect(results).toHaveLength(3);
      for (const result of results) {
        expect(result.embeddings).toHaveLength(1);
        expect(result.embeddings[0]).toEqual([0.1, 0.2, 0.3]);
      }

      expect(mockOllamaClient.embed).toHaveBeenCalledTimes(3);
    });
  });
});