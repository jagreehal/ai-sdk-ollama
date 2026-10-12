import { describe, it, expect, vi } from 'vitest';
import type { OllamaClient } from '../ollama-client';
import { OllamaError } from '../utils/ollama-error';
import { OllamaDecisionModel } from './decision-model';

const response = {
  model: 'nimble',
  answers: {
    team: {
      type: 'choice' as const,
      choice: 'billing',
      probabilities: { billing: 0.97, other: 0.03 },
      confidence: 0.88,
    },
    refund: { type: 'noul' as const, noul: 0.99 },
    urgency: {
      type: 'score' as const,
      score: 0.8,
      legend: { '0': 'Routine', '1': 'Soon', '2': 'Urgent' },
      probabilities: { '0': 0.4, '1': 0.4, '2': 0.2 },
      confidence: 0.03,
    },
  },
  usage: { input_tokens: 784, output_tokens: 3 },
};

const modelWith = (systemone: OllamaClient['systemone']) =>
  new OllamaDecisionModel('nimble', {
    client: { systemone } as OllamaClient,
    provider: 'ollama.decision',
  });

describe('OllamaDecisionModel', () => {
  it('maps questions to System One and answers back to the AI SDK shape', async () => {
    const systemone = vi.fn().mockResolvedValue(response);
    const signal = new AbortController().signal;

    const result = await modelWith(systemone).doDecide({
      state: [
        { type: 'json', value: { ticket: 'Charged twice, refund please' } },
      ],
      questions: {
        team: {
          type: 'choice',
          instructions: 'Which team?',
          criteria: { billing: { covers: 'payments' }, other: null },
        },
        refund: {
          type: 'boolean',
          instructions: 'Asks for a refund?',
          criteria: { true: 'Explicitly asks', false: null },
        },
        urgency: {
          type: 'score',
          instructions: 'How urgent?',
          criteria: ['Routine', null, 'Urgent'],
        },
      },
      abortSignal: signal,
    });

    expect(systemone).toHaveBeenCalledWith(
      {
        model: 'nimble',
        state: { ticket: 'Charged twice, refund please' },
        questions: {
          team: {
            type: 'choice',
            instructions: 'Which team?',
            criteria: { billing: '{"covers":"payments"}', other: null },
          },
          refund: {
            type: 'noul',
            instructions: 'Asks for a refund?',
            criteria: { true: 'Explicitly asks' },
          },
          urgency: {
            type: 'score',
            instructions: 'How urgent?',
            criteria: ['Routine', '', 'Urgent'],
          },
        },
      },
      { signal },
    );

    expect(result.answers).toEqual({
      team: {
        type: 'choice',
        choice: 'billing',
        probabilities: { billing: 0.97, other: 0.03 },
      },
      refund: { type: 'boolean', probability: 0.99 },
      urgency: {
        type: 'score',
        score: 0.8,
        probabilities: { '0': 0.4, '1': 0.4, '2': 0.2 },
      },
    });
    expect(result.usage).toEqual({ inputTokens: 784, outputTokens: 3 });
    expect(result.providerMetadata).toEqual({
      ollama: { confidence: { team: 0.88, urgency: 0.03 } },
    });
  });

  it('sends multi-part state as a list', async () => {
    const systemone = vi.fn().mockResolvedValue({ ...response, answers: {} });
    await modelWith(systemone).doDecide({
      state: [
        { type: 'text', text: 'Ticket:' },
        { type: 'json', value: { id: 42 } },
      ],
      questions: { q: { type: 'boolean', instructions: '?' } },
    });
    expect(systemone.mock.calls[0]?.[0].state).toEqual(['Ticket:', { id: 42 }]);
  });

  it('rejects file parts in state', async () => {
    const systemone = vi.fn();
    await expect(
      modelWith(systemone).doDecide({
        state: [
          {
            type: 'file',
            mediaType: 'image/png',
            data: { type: 'data', data: new Uint8Array([1]) },
          },
        ],
        questions: { q: { type: 'boolean', instructions: '?' } },
      }),
    ).rejects.toThrow(/file parts in decision state/);
    expect(systemone).not.toHaveBeenCalled();
  });

  it('wraps client errors in OllamaError', async () => {
    const systemone = vi
      .fn()
      .mockRejectedValue(new Error('model "nope" not found'));
    await expect(
      modelWith(systemone).doDecide({
        state: [{ type: 'text', text: 'x' }],
        questions: { q: { type: 'boolean', instructions: '?' } },
      }),
    ).rejects.toThrow(OllamaError);
  });

  it('rethrows aborts unchanged', async () => {
    const abort = new DOMException('The operation was aborted.', 'AbortError');
    const systemone = vi.fn().mockRejectedValue(abort);
    await expect(
      modelWith(systemone).doDecide({
        state: [{ type: 'text', text: 'x' }],
        questions: { q: { type: 'boolean', instructions: '?' } },
      }),
    ).rejects.toBe(abort);
  });

  it('throws a clear error when the client has no systemone()', async () => {
    await expect(
      modelWith(undefined).doDecide({
        state: [{ type: 'text', text: 'x' }],
        questions: { q: { type: 'boolean', instructions: '?' } },
      }),
    ).rejects.toThrow(/does not implement systemone/);
  });
});
