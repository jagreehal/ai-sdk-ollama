/**
 * Synthesis: when a run ends with tool results but no answer, one more model
 * call writes the answer from those results. This is the policy that
 * `generateText` and `streamText` share.
 */

import type { ModelMessage, ToolChoice, ToolSet } from 'ai';
import { lastUserText } from '../utils/last-user-text';

export const DEFAULT_SYNTHESIS_PROMPT =
  'Based on the tool results above, please provide a comprehensive response to the original question.';

interface FinishedStep {
  toolCalls: unknown[];
  toolResults: Array<{ toolName: string; input?: unknown; output?: unknown }>;
}

export function forcesTool(toolChoice?: ToolChoice<ToolSet>): boolean {
  return toolChoice === 'required' || typeof toolChoice === 'object';
}

/**
 * A forced tool applies to every step, so a step that answers in text would
 * fail. With only our default `stopWhen`, force the first step alone.
 */
export function prepareStepFor<PREPARE_STEP>(options: {
  toolChoice?: ToolChoice<ToolSet>;
  stopWhen?: unknown;
  prepareStep?: PREPARE_STEP;
}) {
  if (options.prepareStep) return options.prepareStep;
  if (!forcesTool(options.toolChoice) || options.stopWhen) return undefined;
  return ({ stepNumber }: { stepNumber: number }) =>
    stepNumber === 0 ? {} : { toolChoice: 'auto' as const };
}

export function needsSynthesis({
  steps,
  text,
  minLength,
  toolChoice,
}: {
  steps: FinishedStep[];
  text: string;
  minLength: number;
  toolChoice?: ToolChoice<ToolSet>;
}): boolean {
  if (!steps.some((step) => step.toolCalls.length > 0)) return false;

  // Text beside a forced tool call was written before the result existed, so
  // however long it is, it is a preamble and not the answer.
  const endedOnForcedTool =
    forcesTool(toolChoice) && (steps.at(-1)?.toolResults.length ?? 0) > 0;

  return endedOnForcedTool || text.trim().length < minLength;
}

/** The synthesis call has no tools, so a step's tool settings would fail it. */
function withoutToolSettings(prepareStep: (options: never) => unknown) {
  return async (options: never) => {
    const step = await prepareStep(options);
    if (!step) return step;
    const {
      toolChoice: _toolChoice,
      activeTools: _activeTools,
      ...rest
    } = step as Record<string, unknown>;
    return rest;
  };
}

/** Options for the synthesis call: the caller's, without anything tool-related. */
export function buildSynthesisOptions<
  OPTIONS extends {
    tools?: unknown;
    toolChoice?: unknown;
    prepareStep?: (options: never) => unknown;
    prompt?: string | ModelMessage[];
    messages?: ModelMessage[];
  },
>(options: OPTIONS, steps: FinishedStep[], instruction: string) {
  const {
    tools: _tools,
    toolChoice: _toolChoice,
    prepareStep,
    prompt,
    messages,
    ...rest
  } = options;

  const toolContext = steps
    .flatMap((step) => step.toolResults)
    .map(
      ({ toolName, input, output }) =>
        `${toolName}: ${JSON.stringify({ input, output })}`,
    )
    .join('\n');

  const content = `Original request: ${lastUserText(prompt, messages)}

Tool results:
${toolContext}

${instruction}`;

  const base = {
    ...rest,
    ...(prepareStep && { prepareStep: withoutToolSettings(prepareStep) }),
  };

  return messages
    ? { ...base, messages: [...messages, { role: 'user' as const, content }] }
    : { ...base, prompt: content };
}
