/**
 * generateText - Enhanced generateText with Ollama-specific reliability
 *
 * This wrapper provides response synthesis and enhanced tool calling reliability
 * that addresses the core Ollama limitation: tools execute but no final text is generated.
 */

import { generateText as _generateText, stepCountIs } from 'ai';

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
export type GenerateTextOptions = Parameters<typeof _generateText>[0] & {
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
export async function generateText(
  options: GenerateTextOptions,
): Promise<Awaited<ReturnType<typeof _generateText>>> {
  const { enhancedOptions = {}, ...generateTextOptions } = options;

  const {
    enableSynthesis = true,
    synthesisPrompt = 'Based on the tool results above, please provide a comprehensive response to the original question.',
    maxSynthesisAttempts = 2,
    minResponseLength = 10,
    enableToolsWithStructuredOutput = false,
  } = enhancedOptions;

  const hasTools =
    generateTextOptions.tools &&
    Object.keys(generateTextOptions.tools).length > 0;

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
      const structuredResult = await _generateText(
        _generateTextOptions as Parameters<typeof _generateText>[0],
      );

      // Merge tool metadata into structured result
      const enhancedResult = Object.assign(structuredResult, {
        toolCalls: toolResult.toolCalls,
        toolResults: toolResult.toolResults,
        staticToolCalls: toolResult.staticToolCalls,
        dynamicToolCalls: toolResult.dynamicToolCalls,
        staticToolResults: toolResult.staticToolResults,
        dynamicToolResults: toolResult.dynamicToolResults,
        usage: {
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
      });

      return enhancedResult;
    }
  }

  // First, try standard generateText with multi-turn tool calling enabled
  // Automatically forward all AI SDK options, only override stopWhen if needed
  const result = await _generateText({
    ...(generateTextOptions as Parameters<typeof _generateText>[0]),
    // Only set stopWhen default if user didn't provide one and tools are enabled
    stopWhen: (generateTextOptions.stopWhen ??
      (hasTools ? stepCountIs(5) : undefined)) as Parameters<
      typeof _generateText
    >[0]['stopWhen'],
  });

  // Check if we need synthesis (tools called but no meaningful text)
  // Check across all steps to see if any tools were called
  const toolsWereCalled =
    result.steps?.some((step) => step.toolCalls && step.toolCalls.length > 0) ??
    false;
  const hasMinimalText =
    !result.text || result.text.trim().length < minResponseLength;

  if (!hasTools || !toolsWereCalled || !hasMinimalText || !enableSynthesis) {
    return result;
  }

  // Attempt synthesis with tool results
  for (let attempt = 1; attempt <= maxSynthesisAttempts; attempt++) {
    try {
      // Build synthesis prompt with tool context from all steps
      const allToolCalls: Array<{ toolName: string; result: unknown }> = [];

      if (result.steps) {
        for (const step of result.steps) {
          if (step.toolCalls && step.toolResults) {
            for (let i = 0; i < step.toolCalls.length; i++) {
              const toolCall = step.toolCalls[i];
              const toolResult = step.toolResults[i];
              if (toolCall && toolResult) {
                allToolCalls.push({
                  toolName: toolCall.toolName,
                  result: toolResult,
                });
              }
            }
          }
        }
      }

      const toolContext =
        allToolCalls
          .map((tc) => `${tc.toolName}: ${JSON.stringify(tc.result)}`)
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
      const { tools, prompt, messages, ...baseOptions } =
        generateTextOptions as Parameters<typeof _generateText>[0];

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
        // Merge synthesis text and combined usage into result
        const enhancedResult = Object.assign(result, {
          text: synthesisResult.text,
          usage: {
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
        });

        return enhancedResult;
      }
    } catch {
      // Silently continue to next attempt
    }
  }

  return result;
}
