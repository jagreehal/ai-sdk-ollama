import { expect, vi } from 'vitest';
import { AbortableAsyncIterator, ChatResponse, Ollama } from 'ollama';
import { convertArrayToAsyncIterable } from '@ai-sdk/provider-utils/test';
import { OllamaChatSettings } from '../provider';
import { OllamaChatLanguageModel } from './chat-language-model';

export const mockOllamaClient = {
  chat: vi.fn(),
} as unknown as Ollama;

export function createModel(
  settings: OllamaChatSettings = {},
): OllamaChatLanguageModel {
  return new OllamaChatLanguageModel('llama3.2', settings, {
    client: mockOllamaClient,
    provider: 'ollama',
  });
}

/** Mock a streaming chat response (consistent with AI SDK provider patterns). */
export function mockChatStream(data: ChatResponse[]): void {
  const stream = convertArrayToAsyncIterable(data);
  (mockOllamaClient.chat as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
    stream as unknown as AbortableAsyncIterator<ChatResponse>,
  );
}

/**
 * The V4 usage shape for a given token count. `raw` is the provider-shaped
 * passthrough; its contents are asserted in the dedicated `usage.raw` tests.
 */
export function createExpectedUsage(inputTokens: number, outputTokens: number) {
  return {
    inputTokens: {
      total: inputTokens,
      noCache: inputTokens,
      cacheRead: undefined,
      cacheWrite: undefined,
    },
    outputTokens: {
      total: outputTokens,
      text: outputTokens,
      reasoning: undefined,
    },
    raw: expect.any(Object),
  };
}
