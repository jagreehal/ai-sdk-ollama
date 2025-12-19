import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { OllamaRerankingModel } from './reranking-model';

describe('OllamaRerankingModel', () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const createModel = (modelId = 'bge-reranker-v2-m3', settings = {}) =>
    new OllamaRerankingModel(modelId, settings, {
      provider: 'ollama.reranking',
      baseURL: 'http://localhost:11434',
      headers: () => ({}),
      fetch: mockFetch,
    });

  describe('constructor', () => {
    it('should set specificationVersion to v3', () => {
      const model = createModel();
      expect(model.specificationVersion).toBe('v3');
    });

    it('should set modelId correctly', () => {
      const model = createModel('custom-reranker');
      expect(model.modelId).toBe('custom-reranker');
    });

    it('should set provider correctly', () => {
      const model = createModel();
      expect(model.provider).toBe('ollama.reranking');
    });
  });

  describe('doRerank', () => {
    const getLastFetchCall = () => {
      const call = mockFetch.mock.calls.at(-1);
      if (!call) {
        throw new Error('Expected fetch to be called');
      }
      return call as [string, RequestInit];
    };

    const getLastRequestBody = () => {
      const [, options] = getLastFetchCall();
      const { body } = options;
      if (typeof body !== 'string') {
        throw new TypeError('Expected JSON string body');
      }
      return JSON.parse(body) as Record<string, unknown>;
    };

    it('should send correct request body for text documents', async () => {
      const model = createModel();
      const mockResponse = {
        model: 'bge-reranker-v2-m3',
        results: [
          { index: 1, document: 'ML uses neural networks', relevance_score: 0.95 },
          { index: 0, document: 'ML is a subset of AI', relevance_score: 0.85 },
          { index: 2, document: 'Weather is sunny', relevance_score: 0.1 },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => mockResponse,
        text: async () => JSON.stringify(mockResponse),
      });

      await model.doRerank({
        documents: {
          type: 'text',
          values: [
            'ML is a subset of AI',
            'ML uses neural networks',
            'Weather is sunny',
          ],
        },
        query: 'What is machine learning?',
      });

      // Check request body
      expect(mockFetch).toHaveBeenCalledOnce();
      const [url] = getLastFetchCall();
      expect(url).toBe('http://localhost:11434/api/rerank');
      const body = getLastRequestBody();
      expect(body.model).toBe('bge-reranker-v2-m3');
      expect(body.query).toBe('What is machine learning?');
      expect(body.documents).toHaveLength(3);
    });

    it('should return correctly formatted ranking results', async () => {
      const model = createModel();
      const mockResponse = {
        model: 'bge-reranker-v2-m3',
        results: [
          { index: 1, document: 'doc1', relevance_score: 0.95 },
          { index: 0, document: 'doc0', relevance_score: 0.85 },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => mockResponse,
        text: async () => JSON.stringify(mockResponse),
      });

      const result = await model.doRerank({
        documents: { type: 'text', values: ['doc0', 'doc1'] },
        query: 'test query',
      });

      const ranking = result.ranking ?? [];
      expect(ranking).toHaveLength(2);
      expect(ranking[0]).toEqual({ index: 1, relevanceScore: 0.95 });
      expect(ranking[1]).toEqual({ index: 0, relevanceScore: 0.85 });
    });

    it('should include topN in request when provided', async () => {
      const model = createModel();
      const mockResponse = {
        model: 'bge-reranker-v2-m3',
        results: [{ index: 0, document: 'doc', relevance_score: 0.9 }],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => mockResponse,
        text: async () => JSON.stringify(mockResponse),
      });

      await model.doRerank({
        documents: { type: 'text', values: ['doc1', 'doc2', 'doc3'] },
        query: 'test',
        topN: 1,
      });

      const body = getLastRequestBody();
      expect(body.top_n).toBe(1);
    });

    it('should include instruction from settings', async () => {
      const model = createModel('reranker', {
        instruction: 'Judge relevance strictly',
      });
      const mockResponse = {
        model: 'reranker',
        results: [{ index: 0, document: 'doc', relevance_score: 0.9 }],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => mockResponse,
        text: async () => JSON.stringify(mockResponse),
      });

      await model.doRerank({
        documents: { type: 'text', values: ['doc'] },
        query: 'test',
      });

      const body = getLastRequestBody();
      expect(body.instruction).toBe('Judge relevance strictly');
    });

    it('should convert object documents to JSON strings with warning', async () => {
      const model = createModel();
      const mockResponse = {
        model: 'bge-reranker-v2-m3',
        results: [{ index: 0, document: '{"title":"Doc1"}', relevance_score: 0.9 }],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => mockResponse,
        text: async () => JSON.stringify(mockResponse),
      });

      const result = await model.doRerank({
        documents: {
          type: 'object',
          values: [{ title: 'Doc1' }, { title: 'Doc2' }],
        },
        query: 'test',
      });

      // Check that documents are stringified
      const body = getLastRequestBody();
      expect(body.documents[0]).toBe('{"title":"Doc1"}');
      expect(body.documents[1]).toBe('{"title":"Doc2"}');

      // Check warning is present
      expect(result.warnings).toBeDefined();
      expect(result.warnings).toHaveLength(1);
      const warning = result.warnings?.[0];
      expect(warning?.type).toBe('compatibility');
      if (warning?.type === 'compatibility') {
        expect(warning.feature).toBe('object documents');
      }
    });

    it('should include response metadata', async () => {
      const model = createModel();
      const mockResponse = {
        model: 'custom-reranker',
        results: [{ index: 0, document: 'doc', relevance_score: 0.9 }],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({
          'content-type': 'application/json',
          'x-request-id': '12345',
        }),
        json: async () => mockResponse,
        text: async () => JSON.stringify(mockResponse),
      });

      const result = await model.doRerank({
        documents: { type: 'text', values: ['doc'] },
        query: 'test',
      });

      expect(result.response?.modelId).toBe('custom-reranker');
      expect(result.response?.body).toBeDefined();
    });

    it('should handle provider options for instruction override', async () => {
      const model = createModel('reranker', {
        instruction: 'Default instruction',
      });
      const mockResponse = {
        model: 'reranker',
        results: [{ index: 0, document: 'doc', relevance_score: 0.9 }],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => mockResponse,
        text: async () => JSON.stringify(mockResponse),
      });

      await model.doRerank({
        documents: { type: 'text', values: ['doc'] },
        query: 'test',
        providerOptions: {
          ollama: {
            instruction: 'Override instruction',
          },
        },
      });

      const body = getLastRequestBody();
      expect(body.instruction).toBe('Override instruction');
    });
  });
});
