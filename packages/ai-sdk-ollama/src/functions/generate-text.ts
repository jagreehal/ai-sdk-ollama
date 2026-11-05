/**
 * generateText - Enhanced generateText with Ollama-specific reliability
 *
 * When a run ends on tool results with no answer, one more model call writes it.
 */

import type { Context } from '@ai-sdk/provider-utils';
import {
  generateText as _generateText,
  stepCountIs,
  type GenerateTextResult,
  type LanguageModelUsage,
  type OutputInterface,
  type ToolSet,
} from 'ai';
import { addUsage } from '../utils/add-usage';
import {
  buildSynthesisOptions,
  DEFAULT_SYNTHESIS_PROMPT,
  forcesTool,
  needsSynthesis,
  prepareStepFor,
} from './synthesis';

type BaseOptions = Parameters<typeof _generateText>[0];

/**
 * Create a new object that inherits from `base` (preserving its getters/prototype)
 * but with specific properties overridden via own-property descriptors.
 */
function resultWithOverrides<T extends object>(
  base: T,
  overrides: Partial<T>,
): T {
  const descriptors: PropertyDescriptorMap = {};
  for (const key of Object.keys(overrides)) {
    descriptors[key] = {
      value: (overrides as Record<string, unknown>)[key],
      enumerable: true,
      configurable: true,
    };
  }
  return Object.create(base, descriptors) as T;
}

/**
 * Enhanced options for Ollama-specific reliability features
 */
export interface EnhancedOptions {
  /**
   * Enable response synthesis when tools are called but no text is generated
   * @default true
   */
  enableSynthesis?: boolean;

  /**
   * Custom synthesis prompt template
   */
  synthesisPrompt?: string;

  /**
   * Maximum attempts for synthesis
   * @default 2
   */
  maxSynthesisAttempts?: number;

  /**
   * Minimum response length to consider valid
   * @default 10
   */
  minResponseLength?: number;

  /**
   * EXPERIMENTAL: Enable tool calling with structured output (output)
   *
   * When enabled, this uses a two-phase approach:
   * 1. Execute tools first (without output)
   * 2. Generate structured output with tool results injected as context
   *
   * @default false
   */
  enableToolsWithStructuredOutput?: boolean;
}

/**
 * Enhanced generateText options that extend the official AI SDK options
 */
export type GenerateTextOptions<
  TOOLS extends ToolSet = ToolSet,
  RUNTIME_CONTEXT extends Context = Context,
  OUTPUT extends OutputInterface = OutputInterface,
> = Parameters<typeof _generateText<TOOLS, RUNTIME_CONTEXT, OUTPUT>>[0] & {
  /**
   * Enhanced options for Ollama-specific reliability features
   */
  enhancedOptions?: EnhancedOptions;
};

/**
 * Enhanced generateText function with Ollama-specific reliability improvements
 *
 * This function applies synthesis by default when tools execute but return empty responses.
 * The enhancement preserves the original response prototype and all methods/getters.
 *
 * Type parameters are inferred from the options, preserving AI SDK's type inference.
 */
export async function generateText<
  TOOLS extends ToolSet,
  RUNTIME_CONTEXT extends Context = Context,
  OUTPUT extends OutputInterface = OutputInterface<string, string>,
>(
  options: GenerateTextOptions<TOOLS, RUNTIME_CONTEXT, OUTPUT>,
): Promise<GenerateTextResult<ToolSet, RUNTIME_CONTEXT, OUTPUT>>;
// Without this, options typed broadly, such as `activeTools: string[]`, would
// stop compiling once `tools` is concrete.
export async function generateText(
  options: GenerateTextOptions,
): Promise<Awaited<ReturnType<typeof _generateText>>>;
export async function generateText(
  options: GenerateTextOptions,
): Promise<Awaited<ReturnType<typeof _generateText>>> {
  const { enhancedOptions = {}, ...generateTextOptions } = options;

  const {
    enableSynthesis = true,
    synthesisPrompt = DEFAULT_SYNTHESIS_PROMPT,
    maxSynthesisAttempts = 2,
    minResponseLength = 10,
    enableToolsWithStructuredOutput = false,
  } = enhancedOptions;

  const hasTools =
    generateTextOptions.tools &&
    Object.keys(generateTextOptions.tools).length > 0;

  // EXPERIMENTAL: Support tools with structured output (opt-in only)
  const hasOutput = 'output' in generateTextOptions;
  const requiresTools = forcesTool(generateTextOptions.toolChoice);

  if (
    enableToolsWithStructuredOutput &&
    hasOutput &&
    requiresTools &&
    hasTools
  ) {
    // Phase 1: Execute tools without output (omit the key entirely)
    const phase1Options = Object.fromEntries(
      Object.entries(generateTextOptions).filter(([key]) => key !== 'output'),
    );
    const toolResult = await _generateText(
      phase1Options as Parameters<typeof _generateText>[0],
    );

    if (toolResult.toolCalls && toolResult.toolCalls.length > 0) {
      const toolContext = toolResult.toolResults
        ?.map(
          (tr, index) =>
            `${toolResult.toolCalls?.[index]?.toolName}: ${JSON.stringify(tr.output ?? tr)}`,
        )
        .join('\n');

      const toolResultsSuffix = `\n\nTool Results:\n${toolContext}\n\nPlease provide a structured response based on these tool results.`;

      const phase2Base = Object.fromEntries(
        Object.entries(generateTextOptions).filter(
          ([key]) => key !== 'tools' && key !== 'toolChoice',
        ),
      ) as typeof generateTextOptions;
      const phase2OptionsWithPrompt =
        typeof phase2Base.prompt === 'string'
          ? { ...phase2Base, prompt: phase2Base.prompt + toolResultsSuffix }
          : phase2Base.messages
            ? {
                ...phase2Base,
                prompt: undefined,
                messages: [
                  ...phase2Base.messages,
                  { role: 'user' as const, content: toolResultsSuffix.trim() },
                ],
              }
            : phase2Base;

      // Phase 2: Generate structured output with tool context
      const structuredResult = await _generateText(
        phase2OptionsWithPrompt as Parameters<typeof _generateText>[0],
      );

      // Merge tool metadata into structured result (without mutating readonly getters)
      const enhancedResult = resultWithOverrides(structuredResult, {
        toolCalls: toolResult.toolCalls,
        toolResults: toolResult.toolResults,
        staticToolCalls: toolResult.staticToolCalls,
        dynamicToolCalls: toolResult.dynamicToolCalls,
        staticToolResults: toolResult.staticToolResults,
        dynamicToolResults: toolResult.dynamicToolResults,
        usage: addUsage(toolResult.usage, structuredResult.usage),
        totalUsage: addUsage(
          toolResult.totalUsage,
          structuredResult.totalUsage,
        ),
      } as Partial<typeof structuredResult>);

      return enhancedResult;
    }
  }

  const baseOptions = generateTextOptions as BaseOptions;
  const result = await _generateText({
    ...baseOptions,
    stopWhen: baseOptions.stopWhen ?? (hasTools ? stepCountIs(5) : undefined),
    prepareStep: prepareStepFor(baseOptions),
  } as BaseOptions);

  if (
    !hasTools ||
    !enableSynthesis ||
    !needsSynthesis({
      steps: result.steps,
      text: result.text,
      minLength: minResponseLength,
      toolChoice: baseOptions.toolChoice,
    })
  ) {
    return result;
  }

  // Every attempt is a paid model call, so each counts, accepted or not.
  let attemptsUsage: LanguageModelUsage | undefined;
  const withAttemptsUsage = (overrides: Partial<typeof result>) =>
    attemptsUsage
      ? resultWithOverrides(result, {
          ...overrides,
          usage: addUsage(result.usage, attemptsUsage),
          totalUsage: addUsage(result.totalUsage, attemptsUsage),
        })
      : result;

  for (let attempt = 1; attempt <= maxSynthesisAttempts; attempt++) {
    try {
      const synthesisResult = await _generateText(
        buildSynthesisOptions(
          baseOptions,
          result.steps,
          synthesisPrompt,
        ) as BaseOptions,
      );
      attemptsUsage = attemptsUsage
        ? addUsage(attemptsUsage, synthesisResult.usage)
        : synthesisResult.usage;

      if (synthesisResult.text.trim().length >= minResponseLength) {
        return withAttemptsUsage({ text: synthesisResult.text });
      }
    } catch {
      // The next attempt runs, or the loop ends with the result so far.
    }
  }

  return withAttemptsUsage({});
}
