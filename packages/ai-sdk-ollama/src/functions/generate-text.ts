/**
 * generateText - Enhanced generateText with Ollama-specific reliability
 *
 * This wrapper provides response synthesis and enhanced tool calling reliability
 * that addresses the core Ollama limitation: tools execute but no final text is generated.
 */

import { generateText as _generateText } from 'ai';
import type { ToolSet } from 'ai';

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
   * EXPERIMENTAL: Enable tool calling with structured output (experimental_output)
   *
   * The official AI SDK doesn't support combining toolChoice: 'required' with experimental_output.
   * When enabled, this uses a two-phase approach:
   * 1. Execute tools first (without experimental_output)
   * 2. Generate structured output with tool results injected as context
   *
   * This is NOT standard AI SDK behavior - only enable if you need both features together.
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
  OUTPUT = never,
  OUTPUT_PARTIAL = never,
> = Parameters<typeof _generateText<TOOLS, OUTPUT, OUTPUT_PARTIAL>>[0] & {
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
  TOOLS extends ToolSet = ToolSet,
  OUTPUT = never,
  OUTPUT_PARTIAL = never,
>(
  options: GenerateTextOptions<TOOLS, OUTPUT, OUTPUT_PARTIAL>,
): ReturnType<typeof _generateText<TOOLS, OUTPUT, OUTPUT_PARTIAL>> {
  const { enhancedOptions = {}, ...generateTextOptions } = options;

  const {
    enableSynthesis = true,
    synthesisPrompt = 'Based on the tool results above, please provide a comprehensive response to the original question.',
    maxSynthesisAttempts = 2,
    minResponseLength = 10,
    enableToolsWithStructuredOutput = false,
  } = enhancedOptions;

  const hasTools = generateTextOptions.tools && Object.keys(generateTextOptions.tools).length > 0;

  // EXPERIMENTAL: Support tools with structured output (opt-in only)
  const hasExperimentalOutput = 'experimental_output' in generateTextOptions;
  const requiresTools =
    generateTextOptions.toolChoice === 'required' ||
    (typeof generateTextOptions.toolChoice === 'object' &&
      'type' in generateTextOptions.toolChoice &&
      generateTextOptions.toolChoice.type === 'tool');

  if (
    enableToolsWithStructuredOutput &&
    hasExperimentalOutput &&
    requiresTools &&
    hasTools
  ) {
    // Phase 1: Execute tools without experimental_output
    const toolResult = await _generateText({
      ...generateTextOptions,
      experimental_output: undefined,
    });

    // If tools were called, use their results in Phase 2
    if (toolResult.toolCalls && toolResult.toolCalls.length > 0) {
      // Build context with tool results
      const toolContext = toolResult.toolResults
        ?.map(
          (tr, i) =>
            `${toolResult.toolCalls?.[i]?.toolName}: ${JSON.stringify(tr.output || tr)}`,
        )
        .join('\n');

      const contextualPrompt =
        typeof generateTextOptions.prompt === 'string'
          ? `${generateTextOptions.prompt}\n\nTool Results:\n${toolContext}\n\nPlease provide a structured response based on these tool results.`
          : generateTextOptions.prompt;

      const _generateTextOptions = {
        ...generateTextOptions,
        prompt: contextualPrompt,
        tools: undefined,
        toolChoice: undefined,
      };

      // Phase 2: Generate structured output with tool context
      const structuredResult = await _generateText(_generateTextOptions as Parameters<typeof _generateText>[0]);

      // Preserve original prototype while merging properties
      const enhancedResult = Object.create(
        Object.getPrototypeOf(structuredResult),
        Object.getOwnPropertyDescriptors(structuredResult),
      ) as typeof structuredResult;

      // Override properties with tool metadata
      Object.defineProperty(enhancedResult, 'toolCalls', { value: toolResult.toolCalls, enumerable: true });
      Object.defineProperty(enhancedResult, 'toolResults', { value: toolResult.toolResults, enumerable: true });
      Object.defineProperty(enhancedResult, 'staticToolCalls', { value: toolResult.staticToolCalls, enumerable: true });
      Object.defineProperty(enhancedResult, 'dynamicToolCalls', { value: toolResult.dynamicToolCalls, enumerable: true });
      Object.defineProperty(enhancedResult, 'staticToolResults', { value: toolResult.staticToolResults, enumerable: true });
      Object.defineProperty(enhancedResult, 'dynamicToolResults', { value: toolResult.dynamicToolResults, enumerable: true });
      Object.defineProperty(enhancedResult, 'usage', {
        value: {
          inputTokens:
            (toolResult.usage.inputTokens || 0) +
            (structuredResult.usage.inputTokens || 0),
          outputTokens:
            (toolResult.usage.outputTokens || 0) +
            (structuredResult.usage.outputTokens || 0),
          totalTokens:
            (toolResult.usage.totalTokens || 0) +
            (structuredResult.usage.totalTokens || 0),
        },
        enumerable: true,
      });

      return enhancedResult as unknown as Awaited<ReturnType<typeof _generateText<TOOLS, OUTPUT, OUTPUT_PARTIAL>>>;
    }
  }

  // First, try standard generateText
  const result = await _generateText(
    generateTextOptions as Parameters<typeof _generateText>[0],
  );

  // Check if we need synthesis (tools called but no meaningful text)
  const toolsWereCalled = result.toolCalls && result.toolCalls.length > 0;
  const hasMinimalText =
    !result.text || result.text.trim().length < minResponseLength;

  if (!hasTools || !toolsWereCalled || !hasMinimalText || !enableSynthesis) {
    return result as unknown as ReturnType<typeof _generateText<TOOLS, OUTPUT, OUTPUT_PARTIAL>>;
  }

  // Attempt synthesis with tool results
  for (let attempt = 1; attempt <= maxSynthesisAttempts; attempt++) {
    try {
      // Build synthesis prompt with tool context
      const toolContext =
        result.toolResults
          ?.map(
            (tr, i) =>
              `${result.toolCalls?.[i]?.toolName || 'Tool'}: ${JSON.stringify(tr)}`,
          )
          .join('\n') || '';

      const originalPrompt =
        typeof options.prompt === 'string'
          ? options.prompt
          : options.messages?.at(-1)?.content || 'the user question';

      const fullSynthesisPrompt = `Original request: ${originalPrompt}

Tool results:
${toolContext}

${synthesisPrompt}`;

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { tools, prompt, messages, ...baseOptions } = generateTextOptions as Parameters<typeof _generateText>[0];

      // Use messages pattern if original call used messages, otherwise use prompt
      const synthesisOptions = messages
        ? {
            ...baseOptions,
            messages: [
              ...(messages || []),
              { role: 'user' as const, content: fullSynthesisPrompt },
            ],
          }
        : {
            ...baseOptions,
            prompt: fullSynthesisPrompt,
          };

      // Generate synthesis response
      const synthesisResult = await _generateText(
        synthesisOptions as Parameters<typeof _generateText>[0],
      );

      if (
        synthesisResult.text &&
        synthesisResult.text.trim().length >= minResponseLength
      ) {
        // Preserve original prototype while merging properties
        const enhancedResult = Object.create(
          Object.getPrototypeOf(result),
          Object.getOwnPropertyDescriptors(result),
        ) as typeof result;

        // Override text and usage properties
        Object.defineProperty(enhancedResult, 'text', { value: synthesisResult.text, enumerable: true });
        Object.defineProperty(enhancedResult, 'usage', {
          value: {
            inputTokens:
              (result.usage.inputTokens || 0) +
              (synthesisResult.usage.inputTokens || 0),
            outputTokens:
              (result.usage.outputTokens || 0) +
              (synthesisResult.usage.outputTokens || 0),
            totalTokens:
              (result.usage.totalTokens || 0) +
              (synthesisResult.usage.totalTokens || 0),
          },
          enumerable: true,
        });

        return enhancedResult as unknown as ReturnType<typeof _generateText<TOOLS, OUTPUT, OUTPUT_PARTIAL>>;
      }
    } catch {
      // Silently continue to next attempt
    }
  }

  return result as unknown as ReturnType<typeof _generateText<TOOLS, OUTPUT, OUTPUT_PARTIAL>>;
}
