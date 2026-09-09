import { describe, expect, it, vi } from 'vitest';
import type { OllamaClient } from './ollama-client';
import { createOllama } from './provider.browser';

describe('browser createOllama', () => {
  it('honours an injected structural client adapter', async () => {
    const webSearch = vi.fn().mockResolvedValue({ results: [] });
    const client = {
      chat: vi.fn(),
      embed: vi.fn(),
      webSearch,
      webFetch: vi.fn(),
    } as unknown as OllamaClient;

    const provider = createOllama({ client });
    const tool = provider.tools.webSearch();

    await tool.execute!(
      { query: 'ollama' },
      {
        toolCallId: 'test',
        messages: [],
        abortSignal: undefined,
        context: {},
      },
    );

    expect(webSearch).toHaveBeenCalledWith({
      query: 'ollama',
      maxResults: 5,
    });
  });
});
