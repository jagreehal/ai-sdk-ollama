import type { LanguageModelV4Usage } from '@ai-sdk/provider';
import { isStepCount, Output, tool } from 'ai';
import { MockLanguageModelV4 } from 'ai/test';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { generateText, type GenerateTextOptions } from './generate-text';

const usage = {
  inputTokens: { total: 100, noCache: 100, cacheRead: 0, cacheWrite: 0 },
  outputTokens: { total: 20, text: 20, reasoning: 0 },
};
const stop = { unified: 'stop' as const, raw: undefined };

/** Calls a tool, returns empty text, then answers the synthesis request. */
function modelThatForgetsToAnswer(stepUsage: LanguageModelV4Usage = usage) {
  const prompts: unknown[] = [];
  const model = new MockLanguageModelV4({
    doGenerate: async ({ prompt }) => {
      prompts.push(prompt);
      if (prompts.length === 1) {
        return {
          content: [
            {
              type: 'tool-call',
              toolCallId: 'c1',
              toolName: 'lookup',
              input: '{}',
            },
          ],
          finishReason: { unified: 'tool-calls', raw: undefined },
          usage: stepUsage,
          warnings: [],
        };
      }
      if (prompts.length === 2) {
        return {
          content: [],
          finishReason: stop,
          usage: stepUsage,
          warnings: [],
        };
      }
      return {
        content: [{ type: 'text', text: 'The answer is forty-two.' }],
        finishReason: stop,
        usage: stepUsage,
        warnings: [],
      };
    },
  });
  return { model, prompts };
}

const lookup = tool({
  description: 'Look something up.',
  inputSchema: z.object({}),
  execute: async () => ({ value: 42 }),
});

describe('generateText types', () => {
  it('keeps the tool names, so tool-specific options typecheck', async () => {
    const { model } = modelThatForgetsToAnswer();
    await generateText({
      model,
      prompt: 'What is the value?',
      tools: { lookup },
      toolChoice: { type: 'tool', toolName: 'lookup' },
      stopWhen: isStepCount(1),
    });
    const toolName: string = 'lookup';
    const activeTools: string[] = ['lookup'];
    const broad = () =>
      generateText({
        model,
        prompt: 'What is the value?',
        tools: { lookup },
        activeTools,
        toolChoice: { type: 'tool', toolName },
      });
    expect(broad).toBeTypeOf('function');
  });
});

describe('GenerateTextOptions', () => {
  it('accepts a structured output when annotated', () => {
    const options: GenerateTextOptions = {
      model: modelThatForgetsToAnswer().model,
      prompt: 'What is the value?',
      output: Output.object({ schema: z.object({ value: z.number() }) }),
    };
    expect(options.output).toBeDefined();
  });
});

describe('generateText synthesis', () => {
  it('answers when the model calls tools and then returns no text', async () => {
    const { model, prompts } = modelThatForgetsToAnswer();
    const result = await generateText({
      model,
      prompt: 'What is the value?',
      tools: { lookup },
      stopWhen: isStepCount(3),
    });
    expect(result.text).toBe('The answer is forty-two.');
    expect(prompts).toHaveLength(3);
  });

  it('counts the synthesis call in usage and totalUsage', async () => {
    const { model } = modelThatForgetsToAnswer();
    const result = await generateText({
      model,
      prompt: 'What is the value?',
      tools: { lookup },
      stopWhen: isStepCount(3),
    });
    const expected = {
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
    expect(result.usage).toMatchObject(expected);
    expect(result.totalUsage).toMatchObject(expected);
  });

  it('keeps token details Ollama does not report as undefined', async () => {
    const { model } = modelThatForgetsToAnswer({
      inputTokens: {
        total: 100,
        noCache: 100,
        cacheRead: undefined,
        cacheWrite: undefined,
      },
      outputTokens: { total: 20, text: undefined, reasoning: undefined },
    });
    const result = await generateText({
      model,
      prompt: 'What is the value?',
      tools: { lookup },
      stopWhen: isStepCount(3),
    });
    expect(result.totalUsage.inputTokenDetails).toEqual({
      noCacheTokens: 300,
      cacheReadTokens: undefined,
      cacheWriteTokens: undefined,
    });
    expect(result.totalUsage.outputTokenDetails).toEqual({
      textTokens: undefined,
      reasoningTokens: undefined,
    });
  });

  it('synthesizes when tools were required', async () => {
    const { model } = modelThatForgetsToAnswer();
    const result = await generateText({
      model,
      prompt: 'What is the value?',
      tools: { lookup },
      toolChoice: 'required',
      stopWhen: isStepCount(1),
    });
    expect(result.text).toBe('The answer is forty-two.');
  });

  it('lets a later step answer after a required tool call', async () => {
    const { model, prompts } = modelThatForgetsToAnswer();
    const result = await generateText({
      model,
      prompt: 'What is the value?',
      tools: { lookup },
      toolChoice: 'required',
    });
    expect(result.text).toBe('The answer is forty-two.');
    expect(result.steps).toHaveLength(2);
    expect(prompts).toHaveLength(3);
  });

  it('still chains tool calls after a required tool call', async () => {
    let calls = 0;
    const toolCall = (toolCallId: string) => ({
      content: [
        {
          type: 'tool-call' as const,
          toolCallId,
          toolName: 'lookup',
          input: '{}',
        },
      ],
      finishReason: { unified: 'tool-calls' as const, raw: undefined },
      usage,
      warnings: [],
    });
    const model = new MockLanguageModelV4({
      doGenerate: async () => {
        calls += 1;
        return calls < 3
          ? toolCall(`c${calls}`)
          : {
              content: [{ type: 'text', text: 'The answer is forty-two.' }],
              finishReason: stop,
              usage,
              warnings: [],
            };
      },
    });
    const result = await generateText({
      model,
      prompt: 'What is the value?',
      tools: { lookup },
      toolChoice: 'required',
    });
    expect(result.steps).toHaveLength(3);
    expect(result.text).toBe('The answer is forty-two.');
  });

  it('keeps an explicit stopWhen strict about the forced tool', async () => {
    const { model } = modelThatForgetsToAnswer();
    await expect(
      generateText({
        model,
        prompt: 'What is the value?',
        tools: { lookup },
        toolChoice: 'required',
        stopWhen: isStepCount(3),
      }),
    ).rejects.toThrow('tool choice was required');
  });

  it('answers when a forced tool call came with a preamble', async () => {
    const prompts: unknown[] = [];
    const model = new MockLanguageModelV4({
      doGenerate: async ({ prompt }) => {
        prompts.push(prompt);
        return prompts.length === 1
          ? {
              content: [
                { type: 'text', text: 'Let me look that up for you.' },
                {
                  type: 'tool-call',
                  toolCallId: 'c1',
                  toolName: 'lookup',
                  input: '{}',
                },
              ],
              finishReason: { unified: 'tool-calls', raw: undefined },
              usage,
              warnings: [],
            }
          : {
              content: [{ type: 'text', text: 'The answer is forty-two.' }],
              finishReason: stop,
              usage,
              warnings: [],
            };
      },
    });
    const result = await generateText({
      model,
      prompt: 'What is the value?',
      tools: { lookup },
      toolChoice: 'required',
      stopWhen: isStepCount(1),
    });
    expect(result.text).toBe('The answer is forty-two.');
    expect(prompts).toHaveLength(2);
  });

  it('keeps a preamble when the forced tool produced no result', async () => {
    let calls = 0;
    const model = new MockLanguageModelV4({
      doGenerate: async () => {
        calls += 1;
        return {
          content: [
            { type: 'text', text: 'Let me look that up for you.' },
            {
              type: 'tool-call',
              toolCallId: 'c1',
              toolName: 'clientSide',
              input: '{}',
            },
          ],
          finishReason: { unified: 'tool-calls', raw: undefined },
          usage,
          warnings: [],
        };
      },
    });
    const result = await generateText({
      model,
      prompt: 'What is the value?',
      tools: {
        clientSide: tool({
          description: 'Runs on the client.',
          inputSchema: z.object({}),
        }),
      },
      toolChoice: 'required',
    });
    expect(result.text).toBe('Let me look that up for you.');
    expect(calls).toBe(1);
  });

  it('keeps the multi-step default when prepareStep relaxes a forced tool', async () => {
    const { model, prompts } = modelThatForgetsToAnswer();
    const result = await generateText({
      model,
      prompt: 'What is the value?',
      tools: { lookup },
      toolChoice: 'required',
      prepareStep: ({ stepNumber }) =>
        stepNumber === 0 ? {} : { toolChoice: 'auto' },
    });
    expect(result.steps.length).toBeGreaterThan(1);
    expect(result.text).toBe('The answer is forty-two.');
    expect(prompts).toHaveLength(3);
  });

  it('keeps prepareStep overrides but not tool settings for synthesis', async () => {
    const { model, prompts } = modelThatForgetsToAnswer();
    const result = await generateText({
      model,
      prompt: 'What is the value?',
      tools: { lookup },
      stopWhen: isStepCount(1),
      prepareStep: () => ({ toolChoice: 'required', system: 'Be brief.' }),
    });
    expect(result.text).toBe('The answer is forty-two.');
    expect(JSON.stringify(prompts.at(-1))).toContain('Be brief.');
  });

  it('tells tool calls apart by their input in the synthesis prompt', async () => {
    const prompts: unknown[] = [];
    const toolCall = (toolCallId: string, city: string) => ({
      type: 'tool-call' as const,
      toolCallId,
      toolName: 'weather',
      input: JSON.stringify({ city }),
    });
    const model = new MockLanguageModelV4({
      doGenerate: async ({ prompt }) => {
        prompts.push(prompt);
        return prompts.length === 1
          ? {
              content: [toolCall('c1', 'Paris'), toolCall('c2', 'London')],
              finishReason: { unified: 'tool-calls', raw: undefined },
              usage,
              warnings: [],
            }
          : {
              content: [{ type: 'text', text: 'Both are twenty degrees.' }],
              finishReason: stop,
              usage,
              warnings: [],
            };
      },
    });
    await generateText({
      model,
      prompt: 'Compare the cities.',
      tools: {
        weather: tool({
          description: 'Get the weather.',
          inputSchema: z.object({ city: z.string() }),
          execute: async () => ({ temp: 20 }),
        }),
      },
      stopWhen: isStepCount(1),
    });
    const synthesisPrompt = JSON.stringify(prompts.at(-1));
    expect(synthesisPrompt).toContain('Paris');
    expect(synthesisPrompt).toContain('London');
  });

  it('counts rejected synthesis attempts in usage', async () => {
    const { model } = modelThatForgetsToAnswer();
    const result = await generateText({
      model,
      prompt: 'What is the value?',
      tools: { lookup },
      stopWhen: isStepCount(1),
    });
    expect(result.text).toBe('The answer is forty-two.');
    expect(result.usage.inputTokens).toBe(300);
  });

  it('counts synthesis attempts when none is accepted', async () => {
    const { model } = modelThatForgetsToAnswer();
    const result = await generateText({
      model,
      prompt: 'What is the value?',
      tools: { lookup },
      stopWhen: isStepCount(1),
      enhancedOptions: { maxSynthesisAttempts: 1 },
    });
    expect(result.text).toBe('');
    expect(result.usage.inputTokens).toBe(200);
  });

  it('returns the result when a tool output cannot be serialized', async () => {
    const { model } = modelThatForgetsToAnswer();
    const result = await generateText({
      model,
      prompt: 'What is the value?',
      tools: {
        lookup: tool({
          description: 'Look something up.',
          inputSchema: z.object({}),
          execute: async () => ({ value: 42n }),
          toModelOutput: () => ({ type: 'text', value: 'done' }),
        }),
      },
      stopWhen: isStepCount(1),
    });
    expect(result.text).toBe('');
  });

  it('synthesizes when a toolChoice was set', async () => {
    const { model } = modelThatForgetsToAnswer();
    const result = await generateText({
      model,
      prompt: 'What is the value?',
      tools: { lookup },
      toolChoice: 'auto',
      activeTools: ['lookup'],
      stopWhen: isStepCount(3),
    });
    expect(result.text).toBe('The answer is forty-two.');
  });
});

describe('generateText tools with structured output', () => {
  it('counts both phases in usage and totalUsage', async () => {
    let calls = 0;
    const model = new MockLanguageModelV4({
      doGenerate: async () => {
        calls += 1;
        return {
          content:
            calls === 1
              ? [
                  {
                    type: 'tool-call' as const,
                    toolCallId: 'c1',
                    toolName: 'lookup',
                    input: '{}',
                  },
                ]
              : [{ type: 'text' as const, text: '{"value":42}' }],
          finishReason:
            calls === 1
              ? { unified: 'tool-calls' as const, raw: undefined }
              : stop,
          usage,
          warnings: [],
        };
      },
    });
    const result = await generateText({
      model,
      prompt: 'What is the value?',
      tools: { lookup },
      toolChoice: 'required',
      output: Output.object({ schema: z.object({ value: z.number() }) }),
      enhancedOptions: { enableToolsWithStructuredOutput: true },
    });
    const expected = {
      inputTokens: 200,
      inputTokenDetails: { noCacheTokens: 200 },
      outputTokens: 40,
      outputTokenDetails: { textTokens: 40 },
      totalTokens: 240,
    };
    expect(result.usage).toMatchObject(expected);
    expect(result.totalUsage).toMatchObject(expected);
  });
});
