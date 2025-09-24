/**
 * generateText - Enhanced generateText with Ollama-specific reliability
 *
 * This wrapper provides response synthesis and enhanced tool calling reliability
 * that addresses the core Ollama limitation: tools execute but no final text is generated.
 */

import { generateText as _generateText } from 'ai';
import type { LanguageModel } from 'ai';

export interface GenerateTextOptions {
  model: LanguageModel;
  system?: string;
  prompt?: string;
  messages?: Parameters<typeof _generateText>[0]['messages'];
  tools?: Parameters<typeof _generateText>[0]['tools'];
  maxOutputTokens?: number;
  temperature?: number;
  topP?: number;
  topK?: number;
  presencePenalty?: number;
  frequencyPenalty?: number;
  stopSequences?: string[];
  seed?: number;
  maxRetries?: number;
  abortSignal?: AbortSignal;
  headers?: Record<string, string>;
  /**
   * Enhanced options for Ollama-specific reliability features
   */
  enhancedOptions?: {
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
  };
}

/**
 * Enhanced generateText function with Ollama-specific reliability improvements
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
  } = enhancedOptions;

  // First, try standard generateText
  const result = await _generateText(
    generateTextOptions as Parameters<typeof _generateText>[0],
  );

  // Check if we need synthesis (tools called but no meaningful text)
  const hasTools = result.toolCalls && result.toolCalls.length > 0;
  const hasMinimalText =
    !result.text || result.text.trim().length < minResponseLength;

  if (!hasTools || !hasMinimalText || !enableSynthesis) {
    return result;
  }

  console.log('🔧 Applying response synthesis for Ollama...');

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

      // Generate synthesis response
      const synthesisResult = await _generateText({
        ...generateTextOptions,
        prompt: fullSynthesisPrompt,
        tools: undefined, // Don't use tools for synthesis
      } as Parameters<typeof _generateText>[0]);

      if (
        synthesisResult.text &&
        synthesisResult.text.trim().length >= minResponseLength
      ) {
        console.log(`🔧 Response synthesis successful on attempt ${attempt}`);

        // Return enhanced result with original tool data + synthesized text
        return {
          ...result, // Preserve original tool calls and results
          text: synthesisResult.text, // Use synthesized text
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
        };
      }
    } catch (error) {
      console.warn(`🔧 Synthesis attempt ${attempt} failed:`, error);
    }
  }

  console.log('🔧 All synthesis attempts failed, returning original result');
  return result;
}
