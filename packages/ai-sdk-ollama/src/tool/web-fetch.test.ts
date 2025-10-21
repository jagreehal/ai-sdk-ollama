/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { webFetch } from './web-fetch';
import { OllamaError } from '../utils/ollama-error';

// Mock Ollama client
const mockWebFetch = vi.fn();
const mockClient = {
  webFetch: mockWebFetch,
} as any; // Type assertion to avoid full Ollama interface requirements

describe('webFetch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('creates a tool with correct description and schema', () => {
    const tool = webFetch({ client: mockClient });

    expect(tool.description).toContain(
      'Fetch and read content from a specific web URL',
    );
    expect(tool.inputSchema).toBeDefined();
  });

  it('executes web fetch successfully', async () => {
    const mockResult = {
      content: 'This is the content of the web page.',
      title: 'Test Page Title',
    };

    mockWebFetch.mockResolvedValue(mockResult);

    const tool = webFetch({ client: mockClient });
    const result = await tool.execute!(
      { url: 'https://example.com' },
      { toolCallId: 'test', messages: [], abortSignal: undefined },
    );

    expect(mockWebFetch).toHaveBeenCalledWith({ url: 'https://example.com' });

    expect(result).toEqual(
      expect.objectContaining({
        content: expect.any(String),
        title: expect.any(String),
        url: 'https://example.com',
        contentLength: expect.any(Number),
      }),
    );
  });

  it('truncates content when it exceeds maxContentLength', async () => {
    const longContent = 'a'.repeat(15_000);
    const mockResult = {
      content: longContent,
      title: 'Long Article',
    };

    mockWebFetch.mockResolvedValue(mockResult);

    const tool = webFetch({ client: mockClient, maxContentLength: 100 });
    const result = await tool.execute!(
      { url: 'https://example.com/long-article' },
      { toolCallId: 'test', messages: [], abortSignal: undefined },
    );

    expect((result as any).content).toHaveLength(124); // 100 chars + "\n\n[Content truncated...]"
    expect((result as any).content).toContain('[Content truncated...]');
    expect((result as any).contentLength).toBe(124);
  });

  it('handles missing client gracefully', async () => {
    const tool = webFetch(); // No client provided

    await expect(
      tool.execute!(
        { url: 'https://example.com' },
        { toolCallId: 'test', messages: [], abortSignal: undefined },
      ),
    ).rejects.toThrow(OllamaError);
  });

  it('handles fetch errors gracefully by returning error info', async () => {
    mockWebFetch.mockRejectedValue(new Error('404 Not Found'));

    const tool = webFetch({ client: mockClient });
    const result = await tool.execute!(
      { url: 'https://example.com/not-found' },
      { toolCallId: 'test', messages: [], abortSignal: undefined },
    );

    expect(result).toEqual(
      expect.objectContaining({
        content: expect.any(String),
        url: 'https://example.com/not-found',
        contentLength: expect.any(Number),
        error: expect.any(String),
      }),
    );
  });

  it('handles various HTTP error codes', async () => {
    const testCases = [
      {
        error: '403 Forbidden',
        expectedMessage: 'Access to the URL is forbidden (403 error).',
      },
      {
        error: 'SSL certificate error',
        expectedMessage: 'SSL/Certificate error when accessing the URL.',
      },
      {
        error: 'timeout',
        expectedMessage:
          'Web fetch request timed out. The URL may be slow to respond.',
      },
      {
        error: 'API key required',
        expectedMessage:
          'Web fetch requires an Ollama API key. Please set OLLAMA_API_KEY environment variable.',
      },
      {
        error: 'rate limit exceeded',
        expectedMessage:
          'Web fetch rate limit exceeded. Please try again later.',
      },
    ];

    for (const testCase of testCases) {
      mockWebFetch.mockRejectedValue(new Error(testCase.error));

      const tool = webFetch({ client: mockClient });
      const result = await tool.execute!(
        { url: 'https://example.com' },
        { toolCallId: 'test', messages: [], abortSignal: undefined },
      );

      expect((result as any).error).toBe(testCase.expectedMessage);
      vi.clearAllMocks();
    }
  });

  it('handles missing title and content', async () => {
    const mockResult = {}; // No content or title

    mockWebFetch.mockResolvedValue(mockResult);

    const tool = webFetch({ client: mockClient });
    const result = await tool.execute!(
      { url: 'https://example.com' },
      { toolCallId: 'test', messages: [], abortSignal: undefined },
    );

    expect(result).toEqual({
      content: '',
      title: undefined,
      url: 'https://example.com',
      contentLength: 0,
    });
  });

  it('respects timeout option', async () => {
    mockWebFetch.mockResolvedValue({ content: 'test content' });

    const tool = webFetch({ client: mockClient, timeout: 5000 });
    await tool.execute!(
      { url: 'https://example.com' },
      { toolCallId: 'test', messages: [], abortSignal: undefined },
    );

    expect(mockWebFetch).toHaveBeenCalledWith({
      url: 'https://example.com',
      timeout: 5000,
    });
  });

  it('handles aborted requests', async () => {
    const abortController = new AbortController();
    abortController.abort();

    mockWebFetch.mockRejectedValue(new Error('Request aborted'));

    const tool = webFetch({ client: mockClient });
    const result = await tool.execute!(
      { url: 'https://example.com' },
      { toolCallId: 'test', messages: [], abortSignal: abortController.signal },
    );

    expect((result as any).error).toBe('Web fetch request was cancelled.');
  });

  it('validates input schema', () => {
    const tool = webFetch({ client: mockClient });
    const schema = tool.inputSchema as any; // Type assertion for schema parsing

    // Test valid input
    expect(() => schema.parse({ url: 'https://example.com' })).not.toThrow();
    expect(() =>
      schema.parse({ url: 'http://test.org/path?param=value' }),
    ).not.toThrow();

    // Test invalid input
    expect(() => schema.parse({ url: 'not-a-url' })).toThrow(); // Invalid URL
    expect(() => schema.parse({ url: 'ftp://example.com' })).not.toThrow(); // FTP URLs are actually valid URLs
    expect(() => schema.parse({})).toThrow(); // Missing URL
  });

  it('uses default maxContentLength when not specified', async () => {
    const content = 'a'.repeat(15_000); // Exceeds default 10_000
    mockWebFetch.mockResolvedValue({ content, title: 'Test' });

    const tool = webFetch({ client: mockClient });
    const result = await tool.execute!(
      { url: 'https://example.com' },
      { toolCallId: 'test', messages: [], abortSignal: undefined },
    );

    expect((result as any).content).toHaveLength(10_024); // 10_000 + "\n\n[Content truncated...]"
    expect((result as any).content).toContain('[Content truncated...]');
  });
});
