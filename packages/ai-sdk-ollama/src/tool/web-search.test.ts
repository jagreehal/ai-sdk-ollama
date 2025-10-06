/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { webSearch } from './web-search';
import { OllamaError } from '../utils/ollama-error';

// Mock Ollama client
const mockWebSearch = vi.fn();
const mockClient = {
  webSearch: mockWebSearch,
};

describe('webSearch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('creates a tool with correct description and schema', () => {
    const tool = webSearch({ client: mockClient });

    expect(tool.description).toContain(
      'Search the web for current information',
    );
    expect(tool.inputSchema).toBeDefined();
  });

  it('executes web search successfully with default parameters', async () => {
    const mockResults = [
      {
        title: 'Test Article',
        url: 'https://example.com/article',
        snippet: 'This is a test article about AI developments.',
        publishedDate: '2024-01-01',
      },
    ];

    mockWebSearch.mockResolvedValue({ results: mockResults });

    const tool = webSearch({ client: mockClient });
    const result = await tool.execute!(
      { query: 'AI developments' },
      { toolCallId: 'test', messages: [], abortSignal: undefined },
    );

    expect(mockWebSearch).toHaveBeenCalledWith({
      query: 'AI developments',
      maxResults: 5,
    });

    expect(result).toEqual(
      expect.objectContaining({
        results: expect.any(Array),
        searchQuery: 'AI developments',
        totalResults: expect.any(Number),
      }),
    );
  });

  it('respects custom maxResults parameter', async () => {
    mockWebSearch.mockResolvedValue({ results: [] });

    const tool = webSearch({ client: mockClient });
    await tool.execute!(
      { query: 'test query', maxResults: 8 },
      { toolCallId: 'test', messages: [], abortSignal: undefined },
    );

    expect(mockWebSearch).toHaveBeenCalledWith({
      query: 'test query',
      maxResults: 8,
    });
  });

  it('limits maxResults to 20', async () => {
    mockWebSearch.mockResolvedValue({ results: [] });

    const tool = webSearch({ client: mockClient });
    await tool.execute!(
      { query: 'test query', maxResults: 50 },
      { toolCallId: 'test', messages: [], abortSignal: undefined },
    );

    expect(mockWebSearch).toHaveBeenCalledWith({
      query: 'test query',
      maxResults: 20,
    });
  });

  it('handles missing client gracefully', async () => {
    const tool = webSearch(); // No client provided

    await expect(
      tool.execute!(
        { query: 'test query' },
        { toolCallId: 'test', messages: [], abortSignal: undefined },
      ),
    ).rejects.toThrow(OllamaError);
  });

  it('handles API key errors', async () => {
    mockWebSearch.mockRejectedValue(new Error('API key required'));

    const tool = webSearch({ client: mockClient });

    await expect(
      tool.execute!(
        { query: 'test query' },
        { toolCallId: 'test', messages: [], abortSignal: undefined },
      ),
    ).rejects.toThrow(OllamaError);
  });

  it('handles rate limit errors', async () => {
    mockWebSearch.mockRejectedValue(new Error('Rate limit exceeded'));

    const tool = webSearch({ client: mockClient });

    await expect(
      tool.execute!(
        { query: 'test query' },
        { toolCallId: 'test', messages: [], abortSignal: undefined },
      ),
    ).rejects.toThrow(OllamaError);
  });

  it('handles network errors', async () => {
    mockWebSearch.mockRejectedValue(new Error('Network error'));

    const tool = webSearch({ client: mockClient });

    await expect(
      tool.execute!(
        { query: 'test query' },
        { toolCallId: 'test', messages: [], abortSignal: undefined },
      ),
    ).rejects.toThrow(OllamaError);
  });

  it('handles results with missing fields', async () => {
    const incompleteResults = [
      { url: 'https://example.com' }, // Missing title and snippet
      { title: 'Title Only' }, // Missing URL and snippet
      { snippet: 'Snippet only' }, // Missing title and URL
    ];

    mockWebSearch.mockResolvedValue({ results: incompleteResults });

    const tool = webSearch({ client: mockClient });
    const result = await tool.execute!(
      { query: 'test query' },
      { toolCallId: 'test', messages: [], abortSignal: undefined },
    );

    expect(result.results).toEqual(expect.any(Array));
  });

  it('respects timeout option', async () => {
    mockWebSearch.mockResolvedValue({ results: [] });

    const tool = webSearch({ client: mockClient, timeout: 5000 });
    await tool.execute!(
      { query: 'test query' },
      { toolCallId: 'test', messages: [], abortSignal: undefined },
    );

    expect(mockWebSearch).toHaveBeenCalledWith({
      query: 'test query',
      maxResults: 5,
      timeout: 5000,
    });
  });

  it('validates input schema', () => {
    const tool = webSearch({ client: mockClient });
    const schema = tool.inputSchema;

    // Test valid input
    expect(() => schema.parse({ query: 'valid query' })).not.toThrow();
    expect(() =>
      schema.parse({ query: 'valid query', maxResults: 10 }),
    ).not.toThrow();

    // Test invalid input
    expect(() => schema.parse({ query: '' })).toThrow(); // Empty query
    expect(() => schema.parse({ query: 'a'.repeat(501) })).toThrow(); // Too long
    expect(() =>
      schema.parse({ query: 'valid', maxResults: 0 }),
    ).toThrow(); // Invalid max results
    expect(() =>
      schema.parse({ query: 'valid', maxResults: 21 }),
    ).toThrow(); // Too many results
  });
});
