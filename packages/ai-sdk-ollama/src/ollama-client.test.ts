import { describe, expect, it } from 'vitest';
import type { ChatResponse } from 'ollama';
import type { AbortableStream, OllamaClient } from './ollama-client';
import { OllamaChatLanguageModel } from './models/chat-language-model';

function chatResponse(content: string, done: boolean): ChatResponse {
  return {
    model: 'llama3.2',
    created_at: new Date('2026-09-09T00:00:00Z'),
    message: { role: 'assistant', content },
    done,
    done_reason: done ? 'stop' : undefined,
  } as unknown as ChatResponse;
}

/** A hand-rolled abortable stream: no Ollama class involved. */
function abortableStream<T>(items: T[]): AbortableStream<T> {
  return {
    abort() {},
    async *[Symbol.asyncIterator]() {
      yield* items;
    },
  };
}

describe('OllamaClient', () => {
  it('accepts a custom adapter without casting to Ollama classes', async () => {
    // Typed as OllamaClient with no assertion: the contract is structural.
    const client: OllamaClient = {
      chat: (async (request: { stream?: boolean }) =>
        request.stream
          ? abortableStream([chatResponse('4', true)])
          : chatResponse('4', true)) as OllamaClient['chat'],
      embed: async () => ({
        model: 'llama3.2',
        embeddings: [[0.1]],
        total_duration: 1,
        load_duration: 1,
        prompt_eval_count: 1,
      }),
      webSearch: async () => ({ results: [] }),
      webFetch: async () => ({
        url: 'https://example.com',
        title: '',
        content: '',
        links: [],
      }),
    };

    const model = new OllamaChatLanguageModel(
      'llama3.2',
      {},
      { client, provider: 'ollama' },
    );

    const { stream } = await model.doStream({
      prompt: [{ role: 'user', content: [{ type: 'text', text: '2+2?' }] }],
    });
    const chunks = await Array.fromAsync(stream);

    expect(chunks.map((part) => part.type)).toContain('text-delta');
    expect(chunks.at(-1)?.type).toBe('finish');
  });
});
