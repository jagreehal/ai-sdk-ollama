/**
 * generateText with improved reliability for Ollama tool calling
 *
 * This utility provides a wrapper around the AI SDK's generateText function
 * that implements better stop conditions and response synthesis for Ollama models.
 * Instead of using a separate force completion call, it integrates with the AI SDK's
 * tool calling loop to ensure proper response generation.
 */

import { generateText as aiSdkGenerateText } from 'ai';
import type { GenerateTextResult, ToolSet, StepResult } from 'ai';

export interface GenerateTextOllamaOptions {
  /**
   * Whether to enable reliability features
   */
  enableReliability?: boolean;

  /**
   * Maximum number of tool calling steps before forcing completion
   */
  maxSteps?: number;

  /**
   * Minimum response length to consider a completion valid
   */
  minResponseLength?: number;

  /**
   * Whether to add synthesis prompts when tool calls don't produce text
   */
  enableSynthesis?: boolean;

  /**
   * Custom synthesis prompt template
   */
  synthesisPrompt?: string;

  /**
   * Maximum attempts for synthesis step
   */
  maxSynthesisAttempts?: number;
}

/**
 * Enhanced generateText function with improved reliability for Ollama
 */
export async function generateTextOllama<
  TOOLS extends ToolSet,
  OUTPUT = undefined,
  OUTPUT_PARTIAL = undefined,
>(
  options: Parameters<
    typeof aiSdkGenerateText<TOOLS, OUTPUT, OUTPUT_PARTIAL>
  >[0] & {
    enhancedOptions?: GenerateTextOllamaOptions;
  },
): Promise<GenerateTextResult<TOOLS, OUTPUT>> {
  const { enhancedOptions = {}, ...generateTextOptions } = options;
  const {
    enableReliability = true,
    maxSteps = 5,
    minResponseLength = 10,
    enableSynthesis = true,
    synthesisPrompt = 'Please provide a comprehensive response based on the tool results above.',
    maxSynthesisAttempts = 2,
  } = enhancedOptions;

  if (!enableReliability) {
    return aiSdkGenerateText<TOOLS, OUTPUT, OUTPUT_PARTIAL>({
      ...generateTextOptions,
    } as Parameters<
      typeof aiSdkGenerateText<TOOLS, OUTPUT, OUTPUT_PARTIAL>
    >[0]);
  }

  // Enhanced stop conditions that ensure proper completion
  const enhancedStopWhen = [
    // Stop if we exceed max steps
    ({ steps }: { steps: StepResult<TOOLS>[] }) => steps.length >= maxSteps,

    // Stop if we have a good text response (with or without tools)
    ({ steps }: { steps: StepResult<TOOLS>[] }) => {
      const lastStep = steps.at(-1);
      if (!lastStep) return false;

      // If no tools were called, accept any text response
      if (!lastStep.toolCalls || lastStep.toolCalls.length === 0) {
        return (lastStep.text?.trim().length || 0) >= minResponseLength;
      }

      // If tools were called, we need both tool results and a text response
      const hasToolResults =
        lastStep.toolResults && lastStep.toolResults.length > 0;
      const hasGoodText =
        (lastStep.text?.trim().length || 0) >= minResponseLength;

      return hasToolResults && hasGoodText;
    },
  ];

  // First attempt with enhanced stop conditions
  const result = await aiSdkGenerateText<TOOLS, OUTPUT, OUTPUT_PARTIAL>({
    ...generateTextOptions,
    stopWhen: enhancedStopWhen,
  } as Parameters<typeof aiSdkGenerateText<TOOLS, OUTPUT, OUTPUT_PARTIAL>>[0]);

  // Check if we need synthesis (tools were called but no meaningful text response)
  if (enableSynthesis && needsSynthesis(result, minResponseLength)) {
    console.log('🔧 Applying synthesis step...');

    for (let attempt = 1; attempt <= maxSynthesisAttempts; attempt++) {
      try {
        // Build a conversation history that includes the original prompt and tool results
        const originalPrompt =
          typeof generateTextOptions.prompt === 'string'
            ? generateTextOptions.prompt
            : generateTextOptions.messages?.at(-1)?.content ||
              'the user question';

        // Create a synthesis prompt that includes context
        const toolResultsText =
          result.toolResults
            ?.map((tr) => `${tr.toolName}: ${JSON.stringify(tr.output)}`)
            .join('\n') || '';

        const fullSynthesisPrompt = `You previously called tools to gather information. Here's what happened:

Original request: ${originalPrompt}

Tool results:
${toolResultsText}

${synthesisPrompt}`;

        // Run synthesis without tools to avoid recursion
        const synthesisResult = await aiSdkGenerateText<
          TOOLS,
          OUTPUT,
          OUTPUT_PARTIAL
        >({
          model: generateTextOptions.model,
          prompt: fullSynthesisPrompt,
          tools: undefined, // Remove tools to avoid recursion
          stopWhen: [
            ({ steps }: { steps: StepResult<TOOLS>[] }) => steps.length > 0,
          ],
        });

        if (
          synthesisResult.text &&
          synthesisResult.text.trim().length >= minResponseLength
        ) {
          console.log(`🔧 Synthesis successful on attempt ${attempt}`);

          // Return enhanced result with synthesized text
          return {
            ...result,
            text: synthesisResult.text,
            finishReason: 'stop' as const,
            // Keep original tool calls and results
            toolCalls: result.toolCalls,
            toolResults: result.toolResults,
            // Combine usage information
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
          } as GenerateTextResult<TOOLS, OUTPUT>;
        }
      } catch (error) {
        console.warn(`🔧 Synthesis attempt ${attempt} failed:`, error);
      }
    }

    console.log('🔧 All synthesis attempts failed, returning original result');
  }

  return result;
}

/**
 * Check if a result needs synthesis (has tool results but poor text response)
 */
function needsSynthesis<TOOLS extends ToolSet, OUTPUT>(
  result: GenerateTextResult<TOOLS, OUTPUT>,
  minResponseLength: number,
): boolean {
  // Check if we have tool calls and results but poor text response
  const hasToolCalls = result.toolCalls && result.toolCalls.length > 0;
  const hasToolResults = result.toolResults && result.toolResults.length > 0;
  const hasGoodText = (result.text?.trim().length || 0) >= minResponseLength;

  return hasToolCalls && hasToolResults && !hasGoodText;
}
