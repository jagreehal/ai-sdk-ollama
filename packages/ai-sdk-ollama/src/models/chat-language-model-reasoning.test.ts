import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LanguageModelV4CallOptions } from '@ai-sdk/provider';
import { ChatResponse } from 'ollama';
import { createUsage } from './chat-result';
import {
  createModel,
  mockChatStream,
  mockOllamaClient,
} from './chat-language-model.test-helpers';

const options: LanguageModelV4CallOptions = {
  prompt: [
    { role: 'user', content: [{ type: 'text', text: 'What is 2 + 2?' }] },
  ],
};

function response(
  content: string,
  thinking: string,
  done = true,
): ChatResponse {
  return {
    model: 'llama3.2',
    created_at: new Date('2026-09-08T00:00:00Z'),
    message: { role: 'assistant', content, thinking },
    done,
    done_reason: 'stop',
    prompt_eval_count: 3,
    eval_count: 10,
    total_duration: 100,
    load_duration: 10,
    prompt_eval_duration: 20,
    eval_duration: 70,
  };
}

describe('returned reasoning', () => {
  beforeEach(() => vi.clearAllMocks());

  describe.each([undefined, false, true])('think=%s', (think) => {
    it.each(['', '4'])(
      'preserves generated reasoning with text=%j',
      async (text) => {
        vi.mocked(mockOllamaClient.chat).mockResolvedValueOnce(
          response(text, 'Adding two and two.'),
        );

        const result = await createModel({ think }).doGenerate(options);

        expect(result.content).toEqual([
          { type: 'reasoning', text: 'Adding two and two.' },
          ...(text ? [{ type: 'text', text }] : []),
        ]);
        expect(result.usage.outputTokens).toEqual({
          total: 10,
          text: undefined,
          reasoning: undefined,
        });
        expect(result.usage.raw).toMatchObject({ eval_count: 10 });
        // Generation controls must still reach the server unchanged.
        expect(vi.mocked(mockOllamaClient.chat).mock.calls[0]?.[0].think).toBe(
          think,
        );
      },
    );

    describe.each([false, true])('thinking on done=%s', (done) => {
      it.each(['', '4'])(
        'preserves streamed reasoning with text=%j',
        async (text) => {
          mockChatStream(
            done
              ? [response(text, 'Adding two and two.')]
              : [
                  response('', 'Adding two and two.', false),
                  response(text, ''),
                ],
          );

          const { stream } = await createModel({ think }).doStream(options);
          const chunks = await Array.fromAsync(stream);
          const reasoningStart = chunks.find(
            (part) => part.type === 'reasoning-start',
          );
          const textStart = chunks.find((part) => part.type === 'text-start');

          expect(chunks).toEqual([
            { type: 'stream-start', warnings: [] },
            { type: 'reasoning-start', id: expect.any(String) },
            {
              type: 'reasoning-delta',
              id: reasoningStart?.id,
              delta: 'Adding two and two.',
            },
            { type: 'reasoning-end', id: reasoningStart?.id },
            ...(text
              ? [
                  { type: 'text-start', id: expect.any(String) },
                  { type: 'text-delta', id: textStart?.id, delta: text },
                  { type: 'text-end', id: textStart?.id },
                ]
              : []),
            expect.objectContaining({
              type: 'finish',
              finishReason: { unified: 'stop', raw: 'stop' },
              usage: expect.objectContaining({
                outputTokens: {
                  total: 10,
                  text: undefined,
                  reasoning: undefined,
                },
                raw: expect.objectContaining({ eval_count: 10 }),
              }),
            }),
          ]);
          expect(
            vi.mocked(mockOllamaClient.chat).mock.calls[0]?.[0].think,
          ).toBe(think);
        },
      );
    });
  });

  it('closes one reasoning block after intermediate and terminal deltas', async () => {
    mockChatStream([
      response('', 'Adding ', false),
      response('', 'two and two.'),
    ]);
    const { stream } = await createModel().doStream(options);
    const chunks = await Array.fromAsync(stream);
    const start = chunks.find((part) => part.type === 'reasoning-start');
    expect(chunks.slice(1, -1)).toEqual([
      { type: 'reasoning-start', id: expect.any(String) },
      { type: 'reasoning-delta', id: start?.id, delta: 'Adding ' },
      { type: 'reasoning-delta', id: start?.id, delta: 'two and two.' },
      { type: 'reasoning-end', id: start?.id },
    ]);
    expect(chunks.at(-1)?.type).toBe('finish');
  });

  it('closes an open text block before opening reasoning', async () => {
    mockChatStream([
      response('Answer: ', '', false),
      response('', 'Second thought.'),
    ]);
    const { stream } = await createModel().doStream(options);
    const chunks = await Array.fromAsync(stream);
    const textStart = chunks.find((part) => part.type === 'text-start');
    const reasoningStart = chunks.find(
      (part) => part.type === 'reasoning-start',
    );
    expect(chunks.slice(1, -1)).toEqual([
      { type: 'text-start', id: expect.any(String) },
      { type: 'text-delta', id: textStart?.id, delta: 'Answer: ' },
      { type: 'text-end', id: textStart?.id },
      { type: 'reasoning-start', id: expect.any(String) },
      {
        type: 'reasoning-delta',
        id: reasoningStart?.id,
        delta: 'Second thought.',
      },
      { type: 'reasoning-end', id: reasoningStart?.id },
    ]);
    expect(chunks.at(-1)?.type).toBe('finish');
  });

  it.each([undefined, 0, 10])(
    'keeps output total %s without inventing a split',
    (total) => {
      expect(createUsage(3, total).outputTokens).toEqual({
        total,
        text: undefined,
        reasoning: undefined,
      });
    },
  );
});
