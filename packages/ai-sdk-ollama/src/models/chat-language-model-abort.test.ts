import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  LanguageModelV4CallOptions,
  LanguageModelV4FunctionTool,
} from '@ai-sdk/provider';
import { ChatResponse } from 'ollama';
import {
  createModel,
  mockOllamaClient,
} from './chat-language-model.test-helpers';

const emptyResponse = {
  model: 'llama3.2',
  created_at: new Date('2026-09-09T00:00:00Z'),
  message: { role: 'assistant', content: '' },
  done: true,
  done_reason: 'stop',
  prompt_eval_count: 3,
  eval_count: 0,
} as unknown as ChatResponse;

const prompt: LanguageModelV4CallOptions['prompt'] = [
  { role: 'user', content: [{ type: 'text', text: 'Count to zero.' }] },
];

/** Answers once with an empty response, cancelling the request as it does. */
function respondEmptyThenAbort(controller: AbortController) {
  vi.mocked(mockOllamaClient.chat).mockImplementation((async () => {
    controller.abort();
    return emptyResponse;
  }) as never);
}

describe('cancellation during reliability retries', () => {
  beforeEach(() => vi.clearAllMocks());

  it('does not retry or fall back after the signal aborts (object generation)', async () => {
    const controller = new AbortController();
    respondEmptyThenAbort(controller);

    await expect(
      createModel().doGenerate({
        prompt,
        abortSignal: controller.signal,
        responseFormat: {
          type: 'json',
          schema: {
            type: 'object',
            properties: { count: { type: 'number' } },
            required: ['count'],
            additionalProperties: false,
          },
        },
      }),
    ).rejects.toThrow();

    // A retry or a fallback object would have resolved instead.
    expect(mockOllamaClient.chat).toHaveBeenCalledTimes(1);
  });

  it('does not retry after the signal aborts (reliable tool calling)', async () => {
    const controller = new AbortController();
    respondEmptyThenAbort(controller);

    const tools: LanguageModelV4FunctionTool[] = [
      {
        type: 'function',
        name: 'count',
        description: 'Count things',
        inputSchema: { type: 'object', properties: {} },
      },
    ];

    await expect(
      createModel({ reliableToolCalling: true }).doGenerate({
        prompt,
        tools,
        abortSignal: controller.signal,
      }),
    ).rejects.toThrow();

    expect(mockOllamaClient.chat).toHaveBeenCalledTimes(1);
  });
});
