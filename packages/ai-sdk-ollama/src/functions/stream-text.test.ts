import type {
  LanguageModelV4StreamPart,
  LanguageModelV4Usage,
} from '@ai-sdk/provider';
import { isStepCount, Output, simulateReadableStream, tool } from 'ai';
import { MockLanguageModelV4 } from 'ai/test';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { streamText, type StreamTextOptions } from './stream-text';

const usage: LanguageModelV4Usage = {
  inputTokens: { total: 100, noCache: 100, cacheRead: 0, cacheWrite: 0 },
  outputTokens: { total: 20, text: 20, reasoning: 0 },
};
const start: LanguageModelV4StreamPart = {
  type: 'stream-start',
  warnings: [],
};
const finish = (unified: 'stop' | 'tool-calls'): LanguageModelV4StreamPart => ({
  type: 'finish',
  finishReason: { unified, raw: undefined },
  usage,
});

/** Calls a tool, returns empty text, then answers the synthesis request. */
function modelThatForgetsToAnswer() {
  const responses: LanguageModelV4StreamPart[][] = [
    [
      start,
      {
        type: 'tool-call',
        toolCallId: 'c1',
        toolName: 'lookup',
        input: '{}',
      },
      finish('tool-calls'),
    ],
    [start, finish('stop')],
    [
      start,
      { type: 'text-start', id: 't' },
      { type: 'text-delta', id: 't', delta: 'The answer is forty-two.' },
      { type: 'text-end', id: 't' },
      finish('stop'),
    ],
  ];
  return new MockLanguageModelV4({
    doStream: async () => ({
      stream: simulateReadableStream({
        chunks: responses.shift() ?? [start, finish('stop')],
        initialDelayInMs: null,
        chunkDelayInMs: null,
      }),
    }),
  });
}

const lookup = tool({
  description: 'Look something up.',
  inputSchema: z.object({}),
  execute: async () => ({ value: 42 }),
});

const stream = (options: { onEnd?: Callback; onFinish?: Callback } = {}) =>
  streamText({
    model: modelThatForgetsToAnswer(),
    prompt: 'What is the value?',
    tools: { lookup },
    stopWhen: isStepCount(3),
    ...options,
  });

type Callback = (event: { text: string; usage: unknown }) => void;

const answer = 'The answer is forty-two.';

const expectedUsage = {
  inputTokens: 300,
  inputTokenDetails: {
    noCacheTokens: 300,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
  },
  outputTokens: 60,
  outputTokenDetails: { textTokens: 60, reasoningTokens: 0 },
  totalTokens: 360,
};

describe('streamText synthesis usage', () => {
  it('delivers the synthesized answer in chunks', async () => {
    const textChunks: string[] = [];
    for await (const chunk of (await stream()).textStream) {
      textChunks.push(chunk);
    }

    const deltas: string[] = [];
    for await (const part of (await stream()).fullStream) {
      if (part.type === 'text-delta') deltas.push(part.text);
    }

    expect(textChunks).toEqual(['The answer is forty-', 'two.']);
    expect(deltas).toEqual(['The answer', ' is forty-', 'two.']);
  });

  it('ends stream with the synthesized answer and its usage', async () => {
    const result = await stream();
    const parts: Array<{ type: string; totalUsage?: unknown }> = [];
    for await (const part of result.stream) parts.push(part);

    expect(parts.at(-1)?.totalUsage).toMatchObject(expectedUsage);
    expect(parts.some((part) => part.type === 'text-delta')).toBe(true);
  });

  it('ends fullStream with one finish part that counts synthesis', async () => {
    const result = await stream();
    const parts: Array<{ type: string; totalUsage?: unknown }> = [];
    for await (const part of result.fullStream) parts.push(part);

    expect(parts.filter((part) => part.type === 'finish')).toHaveLength(1);
    expect(parts.at(-1)?.type).toBe('finish');
    expect(parts.at(-1)?.totalUsage).toMatchObject(expectedUsage);
    expect(parts.some((part) => part.type === 'text-delta')).toBe(true);
  });

  it('counts synthesis in usage after fullStream', async () => {
    const result = await stream();
    for await (const _part of result.fullStream) {
      // drain
    }
    expect(await result.usage).toMatchObject(expectedUsage);
    expect(await result.totalUsage).toMatchObject(expectedUsage);
  });

  it('counts synthesis in usage after textStream', async () => {
    const result = await stream();
    let text = '';
    for await (const chunk of result.textStream) text += chunk;

    expect(text).toBe('The answer is forty-two.');
    expect(await result.usage).toMatchObject(expectedUsage);
  });

  // A locked-stream rejection here is unhandled, which vitest fails the run on.
  it('keeps result getters readable after streaming', async () => {
    const result = await stream();
    for await (const _chunk of result.textStream) {
      // drain
    }
    expect(await result.steps).toHaveLength(2);
    expect(await result.finishReason).toBe('stop');
  });

  it('counts synthesis when no stream was consumed', async () => {
    const result = await stream();
    expect(await result.text).toBe(answer);
    expect(await result.usage).toMatchObject(expectedUsage);
  });

  it('counts synthesis when usage is read while streaming', async () => {
    const result = await stream();
    const drain = async () => {
      let text = '';
      for await (const chunk of result.textStream) text += chunk;
      return text;
    };
    const [text, total] = await Promise.all([drain(), result.usage]);
    expect(text).toBe(answer);
    expect(total).toMatchObject(expectedUsage);
  });

  it('runs synthesis once however the result is read', async () => {
    const model = modelThatForgetsToAnswer();
    const result = await streamText({
      model,
      prompt: 'What is the value?',
      tools: { lookup },
      stopWhen: isStepCount(3),
    });
    for await (const _part of result.fullStream) {
      // drain
    }
    await Promise.all([result.usage, result.totalUsage, result.text]);
    expect(model.doStreamCalls).toHaveLength(3);
  });
});

describe('streamText synthesis text', () => {
  it('returns the streamed text from result.text', async () => {
    const result = await stream();
    for await (const _part of result.fullStream) {
      // drain
    }
    expect(await result.text).toBe(answer);
  });
});

describe('streamText end callbacks', () => {
  it.each(['onEnd', 'onFinish'] as const)(
    '%s fires once with the synthesis text and usage',
    async (name) => {
      const events: Array<{ text: string; usage: unknown }> = [];
      const onEvent: Callback = (event) => {
        events.push(event);
      };
      const result = await stream({ [name]: onEvent });
      for await (const _chunk of result.textStream) {
        // drain
      }
      expect(events).toHaveLength(1);
      expect(events[0]?.text).toBe(answer);
      expect(events[0]?.usage).toMatchObject(expectedUsage);
    },
  );
});

describe('streamText with a required tool', () => {
  it('lets the next step answer after the tool call', async () => {
    const errors: unknown[] = [];
    const responses: LanguageModelV4StreamPart[][] = [
      [
        start,
        {
          type: 'tool-call',
          toolCallId: 'c1',
          toolName: 'lookup',
          input: '{}',
        },
        finish('tool-calls'),
      ],
      [
        start,
        { type: 'text-start', id: 't' },
        { type: 'text-delta', id: 't', delta: answer },
        { type: 'text-end', id: 't' },
        finish('stop'),
      ],
    ];
    const model = new MockLanguageModelV4({
      doStream: async () => ({
        stream: simulateReadableStream({
          chunks: responses.shift() ?? [start, finish('stop')],
          initialDelayInMs: null,
          chunkDelayInMs: null,
        }),
      }),
    });
    const result = await streamText({
      model,
      prompt: 'What is the value?',
      tools: { lookup },
      toolChoice: 'required',
      onError: ({ error }) => {
        errors.push(error);
      },
    });
    expect(await result.text).toBe(answer);
    expect(await result.steps).toHaveLength(2);
    expect(model.doStreamCalls).toHaveLength(2);
    expect(errors).toEqual([]);
  });
});

describe('streamText with a preamble before a forced tool', () => {
  const preamble = 'Let me look that up for you.';
  const expected = `${preamble}\n\n${answer}`;
  const modelWithPreamble = () => {
    const responses: LanguageModelV4StreamPart[][] = [
      [
        start,
        { type: 'text-start', id: 'p' },
        { type: 'text-delta', id: 'p', delta: preamble },
        { type: 'text-end', id: 'p' },
        {
          type: 'tool-call',
          toolCallId: 'c1',
          toolName: 'lookup',
          input: '{}',
        },
        finish('tool-calls'),
      ],
      [
        start,
        { type: 'text-start', id: 't' },
        { type: 'text-delta', id: 't', delta: answer },
        { type: 'text-end', id: 't' },
        finish('stop'),
      ],
    ];
    return new MockLanguageModelV4({
      doStream: async () => ({
        stream: simulateReadableStream({
          chunks: responses.shift() ?? [start, finish('stop')],
          initialDelayInMs: null,
          chunkDelayInMs: null,
        }),
      }),
    });
  };

  it('streams the answer after the preamble', async () => {
    const model = modelWithPreamble();
    const result = await streamText({
      model,
      prompt: 'What is the value?',
      tools: { lookup },
      toolChoice: 'required',
      stopWhen: isStepCount(1),
    });
    let text = '';
    for await (const chunk of result.textStream) text += chunk;

    expect(text).toBe(expected);
    expect(await result.text).toBe(expected);
    expect(model.doStreamCalls).toHaveLength(2);
  });

  it('leaves the preamble alone when the tool was not forced', async () => {
    const model = modelWithPreamble();
    const result = await streamText({
      model,
      prompt: 'What is the value?',
      tools: { lookup },
      stopWhen: isStepCount(1),
    });
    expect(await result.text).toBe(preamble);
    expect(model.doStreamCalls).toHaveLength(1);
  });
});

describe('streamText with prepareStep', () => {
  it('keeps the multi-step default when it relaxes a forced tool', async () => {
    const model = modelThatForgetsToAnswer();
    const result = await streamText({
      model,
      prompt: 'What is the value?',
      tools: { lookup },
      toolChoice: 'required',
      prepareStep: ({ stepNumber }) =>
        stepNumber === 0 ? {} : { toolChoice: 'auto' },
    });
    expect((await result.steps).length).toBeGreaterThan(1);
  });

  it('keeps its overrides but not its tool settings for synthesis', async () => {
    const errors: unknown[] = [];
    const model = modelThatForgetsToAnswer();
    const result = await streamText({
      model,
      prompt: 'What is the value?',
      tools: { lookup },
      stopWhen: isStepCount(2),
      prepareStep: ({ stepNumber }) =>
        stepNumber === 0
          ? { toolChoice: 'required', system: 'Be brief.' }
          : { system: 'Be brief.' },
      onError: ({ error }) => {
        errors.push(error);
      },
    });
    expect(await result.text).toBe(answer);
    expect(errors).toEqual([]);
    expect(JSON.stringify(model.doStreamCalls.at(-1)?.prompt)).toContain(
      'Be brief.',
    );
  });
});

describe('streamText cancelled during synthesis', () => {
  const stallMs = 300;
  const modelWithSlowSynthesis = () => {
    const model = modelThatForgetsToAnswer();
    let calls = 0;
    return new MockLanguageModelV4({
      doStream: async (options) => {
        calls += 1;
        if (calls === 3) {
          await new Promise((resolve) => setTimeout(resolve, stallMs));
        }
        return model.doStream(options);
      },
    });
  };

  it.each(['textStream', 'fullStream'] as const)(
    '%s cancels at once without throwing',
    async (name) => {
      const result = await streamText({
        model: modelWithSlowSynthesis(),
        prompt: 'What is the value?',
        tools: { lookup },
        stopWhen: isStepCount(3),
      });
      const reader = result[name].getReader();
      void reader.read().catch(() => {});
      await new Promise((resolve) => setTimeout(resolve, 60));

      const startedAt = Date.now();
      await reader.cancel();
      expect(Date.now() - startedAt).toBeLessThan(stallMs / 2);
      await new Promise((resolve) => setTimeout(resolve, stallMs + 50));
    },
  );
});

describe('streamText synthesis prompt', () => {
  it('tells tool calls apart by their input', async () => {
    const model = modelThatForgetsToAnswer();
    const result = await streamText({
      model,
      prompt: 'What is the value?',
      tools: { lookup },
      stopWhen: isStepCount(3),
    });
    await result.text;
    expect(JSON.stringify(model.doStreamCalls.at(-1)?.prompt)).toContain(
      'input',
    );
  });
});

describe('streamText after a reader stops early', () => {
  const settle = () => new Promise((resolve) => setTimeout(resolve, 50));

  it('finishes the run and fires onEnd after a break', async () => {
    const model = modelThatForgetsToAnswer();
    const events: Array<{ text: string }> = [];
    const result = await streamText({
      model,
      prompt: 'What is the value?',
      tools: { lookup },
      stopWhen: isStepCount(3),
      onEnd: (event) => {
        events.push(event);
      },
    });
    for await (const _part of result.fullStream) break;
    await settle();

    expect(events.map((event) => event.text)).toEqual([answer]);
    expect(model.doStreamCalls).toHaveLength(3);
  });

  it('skips synthesis after a break when no end callback can see it', async () => {
    const model = modelThatForgetsToAnswer();
    const result = await streamText({
      model,
      prompt: 'What is the value?',
      tools: { lookup },
      stopWhen: isStepCount(3),
    });
    for await (const _part of result.fullStream) break;
    await settle();

    expect(model.doStreamCalls).toHaveLength(2);
  });

  it('fires onEnd when a reader abandons the stream', async () => {
    const events: unknown[] = [];
    const result = await stream({
      onEnd: (event) => {
        events.push(event);
      },
    });
    await result.fullStream.getReader().read();
    await settle();

    expect(events).toHaveLength(1);
  });
});

describe('streamText short final answers', () => {
  const short = '42.';
  const modelAnsweringBriefly = () => {
    const responses: LanguageModelV4StreamPart[][] = [
      [
        start,
        {
          type: 'tool-call',
          toolCallId: 'c1',
          toolName: 'lookup',
          input: '{}',
        },
        finish('tool-calls'),
      ],
      [
        start,
        { type: 'text-start', id: 's' },
        { type: 'text-delta', id: 's', delta: short },
        { type: 'text-end', id: 's' },
        finish('stop'),
      ],
      [
        start,
        { type: 'text-start', id: 't' },
        { type: 'text-delta', id: 't', delta: answer },
        { type: 'text-end', id: 't' },
        finish('stop'),
      ],
    ];
    return new MockLanguageModelV4({
      doStream: async () => ({
        stream: simulateReadableStream({
          chunks: responses.shift() ?? [start, finish('stop')],
          initialDelayInMs: null,
          chunkDelayInMs: null,
        }),
      }),
    });
  };

  it('leaves a short answer alone in fullStream', async () => {
    const model = modelAnsweringBriefly();
    const result = await streamText({
      model,
      prompt: 'What is the value?',
      tools: { lookup },
    });
    for await (const _part of result.fullStream) {
      // drain
    }
    expect(await result.text).toBe(short);
    expect(model.doStreamCalls).toHaveLength(2);
  });

  it('applies minStreamLength to textStream', async () => {
    const model = modelAnsweringBriefly();
    const result = await streamText({
      model,
      prompt: 'What is the value?',
      tools: { lookup },
    });
    let text = '';
    for await (const chunk of result.textStream) text += chunk;

    expect(text).toBe(`${short}\n\n${answer}`);
    expect(model.doStreamCalls).toHaveLength(3);
  });
});

describe('streamText keeps its released synthesis rules', () => {
  const textParts = (id: string, ...deltas: string[]) =>
    [
      { type: 'text-start', id },
      ...deltas.map((delta) => ({ type: 'text-delta', id, delta })),
      { type: 'text-end', id },
    ] as LanguageModelV4StreamPart[];
  const toolCallPart: LanguageModelV4StreamPart = {
    type: 'tool-call',
    toolCallId: 'c1',
    toolName: 'lookup',
    input: '{}',
  };
  const modelReplying = (...responses: LanguageModelV4StreamPart[][]) =>
    new MockLanguageModelV4({
      doStream: async () => ({
        stream: simulateReadableStream({
          chunks: responses.shift() ?? [start, finish('stop')],
          initialDelayInMs: null,
          chunkDelayInMs: null,
        }),
      }),
    });
  const toolStep = [start, toolCallPart, finish('tool-calls')];
  const options = { prompt: 'What is the value?', tools: { lookup } };

  it('leaves a short answer alone when only text is read', async () => {
    const model = modelReplying(toolStep, [
      start,
      ...textParts('s', 'Sunny.'),
      finish('stop'),
    ]);
    const result = await streamText({ model, ...options });
    expect(await result.text).toBe('Sunny.');
    expect(model.doStreamCalls).toHaveLength(2);
  });

  it('leaves a short answer after a preamble alone in textStream', async () => {
    const model = modelReplying(
      [
        start,
        ...textParts('p', 'Let me look that up.'),
        toolCallPart,
        finish('tool-calls'),
      ],
      [start, ...textParts('s', 'Sunny.'), finish('stop')],
    );
    const result = await streamText({ model, ...options });
    for await (const _chunk of result.textStream) {
      // drain
    }
    expect(model.doStreamCalls).toHaveLength(2);
  });

  it('does not synthesize for text when no tool produced a result', async () => {
    const model = modelReplying(toolStep);
    const result = await streamText({
      model,
      prompt: 'What is the value?',
      tools: {
        lookup: tool({
          description: 'Runs on the client.',
          inputSchema: z.object({}),
        }),
      },
    });
    expect(await result.text).toBe('');
    expect(model.doStreamCalls).toHaveLength(1);
  });

  it('does not synthesize an answer nobody reads after textStream stops', async () => {
    const model = modelReplying(
      [
        start,
        ...textParts('p', 'Let ', 'me ', 'check.'),
        toolCallPart,
        finish('tool-calls'),
      ],
      [start, finish('stop')],
      [start, ...textParts('t', answer), finish('stop')],
    );
    const result = await streamText({ model, ...options });
    for await (const _chunk of result.textStream) break;
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(model.doStreamCalls).toHaveLength(2);
  });

  it('treats minStreamLength 0 as off', async () => {
    const model = modelReplying(toolStep, [start, finish('stop')]);
    const result = await streamText({
      model,
      ...options,
      enhancedOptions: { minStreamLength: 0 },
    });
    for await (const _part of result.fullStream) {
      // drain
    }
    expect(model.doStreamCalls).toHaveLength(2);
  });

  it('still ends fullStream with finish after a failed step', async () => {
    let calls = 0;
    const result = await streamText({
      model: new MockLanguageModelV4({
        doStream: async () => {
          calls += 1;
          if (calls === 2) throw new Error('model down');
          return {
            stream: simulateReadableStream({
              chunks: toolStep,
              initialDelayInMs: null,
              chunkDelayInMs: null,
            }),
          };
        },
      }),
      ...options,
      onError: () => {},
    });
    const types: string[] = [];
    for await (const part of result.fullStream) types.push(part.type);
    expect(types).toContain('error');
    expect(types.at(-1)).toBe('finish');
  });
});

describe('streamText synthesis is only for readers of the answer', () => {
  it('adds no model call when only usage is read', async () => {
    const model = modelThatForgetsToAnswer();
    const result = await streamText({
      model,
      prompt: 'What is the value?',
      tools: { lookup },
      stopWhen: isStepCount(3),
    });
    expect((await result.usage).inputTokens).toBe(200);
    expect(model.doStreamCalls).toHaveLength(2);
  });

  it('settles usage after a reader stops early', async () => {
    const result = await stream();
    for await (const _part of result.fullStream) break;
    expect((await result.usage).inputTokens).toBeGreaterThan(0);
  });

  it('includes the answer and its usage for onFinish with the UI stream', async () => {
    const model = modelThatForgetsToAnswer();
    const events: Array<{ text: string }> = [];
    const result = await streamText({
      model,
      prompt: 'What is the value?',
      tools: { lookup },
      stopWhen: isStepCount(3),
      onFinish: (event) => {
        events.push(event);
      },
    });
    for await (const _chunk of result.toUIMessageStream()) {
      // drain
    }
    expect((await result.usage).inputTokens).toBe(300);
    expect(model.doStreamCalls).toHaveLength(3);
    expect(events.map((event) => event.text)).toEqual([answer]);
  });

  it('reuses the UI stream synthesis for text read afterwards', async () => {
    const model = modelThatForgetsToAnswer();
    const result = await streamText({
      model,
      prompt: 'What is the value?',
      tools: { lookup },
      stopWhen: isStepCount(3),
    });
    for await (const _chunk of result.toUIMessageStream()) {
      // drain
    }
    expect(await result.text).toBe(answer);
    expect(model.doStreamCalls).toHaveLength(3);
  });

  it('adds no model call for onEnd with consumeStream', async () => {
    const model = modelThatForgetsToAnswer();
    const result = await streamText({
      model,
      prompt: 'What is the value?',
      tools: { lookup },
      stopWhen: isStepCount(3),
      onEnd: () => {},
    });
    await result.consumeStream();
    expect(model.doStreamCalls).toHaveLength(2);
  });
});

describe('streamText response helpers', () => {
  const uiText = (chunks: Array<{ type: string; delta?: string }>) =>
    chunks
      .filter((chunk) => chunk.type === 'text-delta')
      .map((chunk) => chunk.delta)
      .join('');

  const readUi = async (result: Awaited<ReturnType<typeof stream>>) => {
    const chunks: Array<{ type: string; delta?: string }> = [];
    for await (const chunk of result.toUIMessageStream()) chunks.push(chunk);
    return chunks;
  };

  it('puts the answer in the UI stream before finish', async () => {
    const chunks = await readUi(await stream());

    expect(uiText(chunks)).toBe(answer);
    expect(chunks.at(-1)?.type).toBe('finish');
  });

  it('puts the answer in toUIMessageStreamResponse', async () => {
    const result = await stream();

    expect(await result.toUIMessageStreamResponse().text()).toContain('forty-');
  });

  it('puts the answer in toTextStreamResponse', async () => {
    const result = await stream();

    expect(await result.toTextStreamResponse().text()).toBe(answer);
  });

  it('lets two readers of the UI stream share one synthesis call', async () => {
    const model = modelThatForgetsToAnswer();
    const result = await streamText({
      model,
      prompt: 'What is the value?',
      tools: { lookup },
      stopWhen: isStepCount(3),
    });
    const [first, second] = await Promise.all([readUi(result), readUi(result)]);

    expect(uiText(first)).toBe(answer);
    expect(uiText(second)).toBe(answer);
    expect(model.doStreamCalls).toHaveLength(3);
  });

  it('answers the UI stream alongside consumeStream', async () => {
    const result = await stream();
    void result.consumeStream();

    expect(uiText(await readUi(result))).toBe(answer);
  });
});

describe('streamText onEnd with synthesis', () => {
  it('includes the answer in responseMessages and content', async () => {
    let event: { responseMessages: unknown[]; content: unknown[] } | undefined;
    const result = await streamText({
      model: modelThatForgetsToAnswer(),
      prompt: 'What is the value?',
      tools: { lookup },
      stopWhen: isStepCount(3),
      onEnd: (end) => {
        event = end;
      },
    });
    for await (const _chunk of result.textStream) {
      // drain
    }
    expect(event?.content.at(-1)).toMatchObject({ type: 'text', text: answer });
    expect(event?.responseMessages.at(-1)).toMatchObject({
      role: 'assistant',
      content: [{ type: 'text', text: answer }],
    });
  });
});

describe('streamText text with an earlier short preamble', () => {
  it('has no leading blank lines when the final step is empty', async () => {
    const responses: LanguageModelV4StreamPart[][] = [
      [
        start,
        { type: 'text-start', id: 'p' },
        { type: 'text-delta', id: 'p', delta: 'Ok.' },
        { type: 'text-end', id: 'p' },
        {
          type: 'tool-call',
          toolCallId: 'c1',
          toolName: 'lookup',
          input: '{}',
        },
        finish('tool-calls'),
      ],
      [start, finish('stop')],
      [
        start,
        { type: 'text-start', id: 't' },
        { type: 'text-delta', id: 't', delta: answer },
        { type: 'text-end', id: 't' },
        finish('stop'),
      ],
    ];
    const result = await streamText({
      model: new MockLanguageModelV4({
        doStream: async () => ({
          stream: simulateReadableStream({
            chunks: responses.shift() ?? [start, finish('stop')],
            initialDelayInMs: null,
            chunkDelayInMs: null,
          }),
        }),
      }),
      prompt: 'What is the value?',
      tools: { lookup },
      stopWhen: isStepCount(3),
    });
    expect(await result.text).toBe(answer);
  });
});

describe('StreamTextOptions', () => {
  it('accepts broad tool options with concrete tools', async () => {
    const activeTools: string[] = ['lookup'];
    const result = await streamText({
      model: modelThatForgetsToAnswer(),
      prompt: 'What is the value?',
      tools: { lookup },
      activeTools,
    });
    expect(result).toBeDefined();
  });

  it('accepts a structured output when annotated', () => {
    const options: StreamTextOptions = {
      model: modelThatForgetsToAnswer(),
      prompt: 'What is the value?',
      output: Output.object({ schema: z.object({ value: z.number() }) }),
    };
    expect(options.output).toBeDefined();
  });
});

describe('streamText with a preamble and an empty final step', () => {
  const preamble = 'Let me look that up for you.';
  const expected = `${preamble}\n\n${answer}`;
  const toolStep: LanguageModelV4StreamPart[] = [
    start,
    { type: 'text-start', id: 'p' },
    { type: 'text-delta', id: 'p', delta: preamble },
    { type: 'text-end', id: 'p' },
    { type: 'tool-call', toolCallId: 'c1', toolName: 'lookup', input: '{}' },
    finish('tool-calls'),
  ];
  const answerStep: LanguageModelV4StreamPart[] = [
    start,
    { type: 'text-start', id: 't' },
    { type: 'text-delta', id: 't', delta: answer },
    { type: 'text-end', id: 't' },
    finish('stop'),
  ];
  const modelReplying = (...responses: LanguageModelV4StreamPart[][]) =>
    new MockLanguageModelV4({
      doStream: async () => ({
        stream: simulateReadableStream({
          chunks: responses.shift() ?? [start, finish('stop')],
          initialDelayInMs: null,
          chunkDelayInMs: null,
        }),
      }),
    });

  it.each([
    ['forced', { toolChoice: 'required' as const }],
    ['unforced', {}],
  ])('synthesizes the answer when the tool was %s', async (_name, choice) => {
    const model = modelReplying(toolStep, [start, finish('stop')], answerStep);
    const result = await streamText({
      model,
      prompt: 'What is the value?',
      tools: { lookup },
      ...choice,
    });
    let text = '';
    for await (const chunk of result.textStream) text += chunk;

    expect(text).toBe(expected);
    expect(await result.text).toBe(answer);
    expect(model.doStreamCalls).toHaveLength(3);
  });

  it('makes no extra call when the final step answered', async () => {
    const model = modelReplying(toolStep, answerStep);
    const result = await streamText({
      model,
      prompt: 'What is the value?',
      tools: { lookup },
    });
    expect(await result.text).toBe(answer);
    expect(model.doStreamCalls).toHaveLength(2);
  });
});

describe('streamText without synthesis', () => {
  it('passes results through when the model answered', async () => {
    const model = new MockLanguageModelV4({
      doStream: async () => ({
        stream: simulateReadableStream({
          chunks: [
            start,
            { type: 'text-start', id: 't' },
            { type: 'text-delta', id: 't', delta: answer },
            { type: 'text-end', id: 't' },
            finish('stop'),
          ],
          initialDelayInMs: null,
          chunkDelayInMs: null,
        }),
      }),
    });
    const events: Array<{ text: string }> = [];
    const result = await streamText({
      model,
      prompt: 'What is the value?',
      tools: { lookup },
      onEnd: (event) => {
        events.push(event);
      },
    });
    expect(await result.text).toBe(answer);
    expect((await result.usage).inputTokens).toBe(100);
    expect(model.doStreamCalls).toHaveLength(1);
    expect(events.map((event) => event.text)).toEqual([answer]);
  });

  it('ends the streams with an error part when the run fails', async () => {
    const failing = () =>
      streamText({
        model: new MockLanguageModelV4({
          doStream: async () => {
            throw new Error('model down');
          },
        }),
        prompt: 'What is the value?',
        tools: { lookup },
        onError: () => {},
      });

    const types: string[] = [];
    for await (const part of (await failing()).stream) types.push(part.type);
    expect(types).toContain('error');
    expect(types).not.toContain('finish');

    const body = await (await failing()).toUIMessageStreamResponse().text();
    expect(body).toContain('"type":"error"');
  });

  it('rejects rather than hangs when the stream fails', async () => {
    const result = await streamText({
      model: new MockLanguageModelV4({
        doStream: async () => {
          throw new Error('model down');
        },
      }),
      prompt: 'What is the value?',
      tools: { lookup },
      onError: () => {},
    });
    await expect(result.usage).rejects.toThrow();
    await expect(result.text).rejects.toThrow();
  });

  // Vitest fails the run on an unhandled rejection, as Node exits on one.
  it('does not leave an unhandled rejection from an unread getter', async () => {
    const result = await streamText({
      model: new MockLanguageModelV4({
        doStream: async () => {
          throw new Error('model down');
        },
      }),
      prompt: 'What is the value?',
      tools: { lookup },
      onError: () => {},
    });
    const { usage, totalUsage, text } = result;
    await new Promise((resolve) => setTimeout(resolve, 20));
    await expect(usage).rejects.toThrow();
    await expect(totalUsage).rejects.toThrow();
    await expect(text).rejects.toThrow();
  });

  it('rejects rather than hangs when aborted', async () => {
    const controller = new AbortController();
    controller.abort(new Error('stopped'));
    const result = await streamText({
      model: modelThatForgetsToAnswer(),
      prompt: 'What is the value?',
      tools: { lookup },
      abortSignal: controller.signal,
      onEnd: () => {},
    });
    await expect(result.usage).rejects.toThrow('stopped');
  });
});
