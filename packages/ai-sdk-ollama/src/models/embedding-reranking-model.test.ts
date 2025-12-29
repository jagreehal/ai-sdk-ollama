import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { OllamaEmbeddingRerankingModel } from './embedding-reranking-model';

describe('OllamaEmbeddingRerankingModel', () => {
  const mockEmbed = vi.fn();
  const mockClient = {
    embed: mockEmbed,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const createModel = (modelId = 'bge-m3', settings = {}) =>
    new OllamaEmbeddingRerankingModel(modelId, settings, {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      client: mockClient as any,
      provider: 'ollama.embedding-reranking',
    });

  describe('constructor', () => {
    it('should set specificationVersion to v3', () => {
      const model = createModel();
      expect(model.specificationVersion).toBe('v3');
    });

    it('should set modelId correctly', () => {
      const model = createModel('nomic-embed-text');
      expect(model.modelId).toBe('nomic-embed-text');
    });

    it('should set provider correctly', () => {
      const model = createModel();
      expect(model.provider).toBe('ollama.embedding-reranking');
    });
  });

  describe('doRerank', () => {
    const createMockEmbeddings = (...values: number[][]) => ({
      embeddings: values,
    });

    it('should call embed for query and all documents', async () => {
      const model = createModel();

      mockEmbed.mockResolvedValueOnce(
        createMockEmbeddings([1, 0, 0], [1, 0, 0], [0, 1, 0], [0.7, 0.7, 0]),
      );

      await model.doRerank({
        documents: {
          type: 'text',
          values: ['doc1', 'doc2', 'doc3'],
        },
        query: 'test query',
      });

      expect(mockEmbed).toHaveBeenCalledTimes(1);
      expect(mockEmbed).toHaveBeenCalledWith({
        model: 'bge-m3',
        input: ['test query', 'doc1', 'doc2', 'doc3'],
      });
    });

    it('should rank documents by cosine similarity (descending)', async () => {
      const model = createModel();

      // Query embedding points in [1, 0, 0] direction
      mockEmbed.mockResolvedValueOnce(
        createMockEmbeddings(
          [1, 0, 0], // query
          [1, 0, 0],
          [0, 1, 0],
          [1 / Math.sqrt(2), 1 / Math.sqrt(2), 0],
        ),
      );

      const result = await model.doRerank({
        documents: {
          type: 'text',
          values: ['identical', 'orthogonal', 'similar'],
        },
        query: 'test',
      });

      const ranking = result.ranking ?? [];
      expect(ranking).toHaveLength(3);
      // Document 0 (identical) should be first
      expect(ranking[0]?.index).toBe(0);
      expect(ranking[0]?.relevanceScore).toBeCloseTo(1, 5);
      // Document 2 (similar) should be second
      expect(ranking[1]?.index).toBe(2);
      expect(ranking[1]?.relevanceScore).toBeCloseTo(0.7071, 3);
      // Document 1 (orthogonal) should be last
      expect(ranking[2]?.index).toBe(1);
      expect(ranking[2]?.relevanceScore).toBeCloseTo(0, 5);
    });

    it('should respect topN parameter', async () => {
      const model = createModel();

      mockEmbed.mockResolvedValueOnce(
        createMockEmbeddings(
          [1, 0, 0],
          [0.9, 0.1, 0],
          [0.5, 0.5, 0],
          [0.1, 0.9, 0],
        ),
      );

      const result = await model.doRerank({
        documents: {
          type: 'text',
          values: ['doc1', 'doc2', 'doc3'],
        },
        query: 'test',
        topN: 2,
      });

      expect(result.ranking ?? []).toHaveLength(2);
    });

    it('should use custom embedding model from settings', async () => {
      const model = createModel('default-model', {
        embeddingModel: 'nomic-embed-text',
      });

      mockEmbed.mockResolvedValueOnce(createMockEmbeddings([1, 0], [1, 0]));

      await model.doRerank({
        documents: { type: 'text', values: ['doc'] },
        query: 'test',
      });

      expect(mockEmbed).toHaveBeenCalledWith({
        model: 'nomic-embed-text',
        input: ['test', 'doc'],
      });
    });

    it('should convert object documents to JSON strings with warning', async () => {
      const model = createModel();

      mockEmbed.mockResolvedValueOnce(
        createMockEmbeddings([1, 0], [0.9, 0.1], [0.5, 0.5]),
      );

      const result = await model.doRerank({
        documents: {
          type: 'object',
          values: [{ title: 'Doc1' }, { title: 'Doc2' }],
        },
        query: 'test',
      });

      // Check that JSON strings were passed to embed
      expect(mockEmbed).toHaveBeenCalledWith({
        model: 'bge-m3',
        input: ['test', '{"title":"Doc1"}', '{"title":"Doc2"}'],
      });

      // Check warning is present
      expect(result.warnings).toBeDefined();
      expect(result.warnings).toHaveLength(1);
      const warning = result.warnings?.[0];
      expect(warning?.type).toBe('compatibility');
      if (warning?.type === 'compatibility') {
        expect(warning.feature).toBe('object documents');
      }
    });

    it('should handle empty documents array', async () => {
      const model = createModel();

      const result = await model.doRerank({
        documents: { type: 'text', values: [] },
        query: 'test',
      });

      expect(result.ranking).toHaveLength(0);
      expect(mockEmbed).not.toHaveBeenCalled();
    });

    it('should include response metadata with modelId', async () => {
      const model = createModel('mxbai-embed-large');

      mockEmbed.mockResolvedValueOnce(createMockEmbeddings([1], [1]));

      const result = await model.doRerank({
        documents: { type: 'text', values: ['doc'] },
        query: 'test',
      });

      expect(result.response?.modelId).toBe('mxbai-embed-large');
    });

    it('should handle single document', async () => {
      const model = createModel();

      mockEmbed.mockResolvedValueOnce(createMockEmbeddings([1, 0], [0.8, 0.2]));

      const result = await model.doRerank({
        documents: { type: 'text', values: ['single doc'] },
        query: 'test',
      });

      const ranking = result.ranking ?? [];
      expect(ranking).toHaveLength(1);
      expect(ranking[0]?.index).toBe(0);
    });

    it('should split embedding requests based on maxBatchSize', async () => {
      const model = createModel('bge-m3', { maxBatchSize: 2 });

      mockEmbed
        .mockResolvedValueOnce(createMockEmbeddings([1, 0], [0.8, 0.2]))
        .mockResolvedValueOnce(createMockEmbeddings([0.5, 0.5], [0.1, 0.9]));

      await model.doRerank({
        documents: { type: 'text', values: ['doc1', 'doc2', 'doc3'] },
        query: 'test',
      });

      expect(mockEmbed).toHaveBeenCalledTimes(2);
      expect(mockEmbed).toHaveBeenNthCalledWith(1, {
        model: 'bge-m3',
        input: ['test', 'doc1'],
      });
      expect(mockEmbed).toHaveBeenNthCalledWith(2, {
        model: 'bge-m3',
        input: ['doc2', 'doc3'],
      });
    });
  });
});
