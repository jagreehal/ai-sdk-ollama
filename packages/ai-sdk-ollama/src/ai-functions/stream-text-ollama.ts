/**
 * streamText with improved reliability for Ollama tool calling
 *
 * This utility provides a wrapper around the AI SDK's streamText function
 * that implements better stop conditions and response synthesis for Ollama models.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { streamText as aiSdkStreamText } from 'ai';
import type { ToolSet, StepResult, StreamTextResult } from 'ai';

export interface StreamTextOllamaOptions {
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
 * Enhanced streamText function with improved reliability for Ollama
 */
export async function streamTextOllama<
  TOOLS extends ToolSet,
  OUTPUT = undefined,
  OUTPUT_PARTIAL = undefined,
>(
  options: Parameters<
    typeof aiSdkStreamText<TOOLS, OUTPUT, OUTPUT_PARTIAL>
  >[0] & {
    enhancedOptions?: StreamTextOllamaOptions;
  },
): Promise<StreamTextResult<TOOLS, OUTPUT_PARTIAL>> {
  const { enhancedOptions = {}, ...streamTextOptions } = options;
  const {
    enableReliability = true,
    maxSteps = 5,
    minResponseLength = 10,
  } = enhancedOptions;

  if (!enableReliability) {
    return aiSdkStreamText<TOOLS, OUTPUT, OUTPUT_PARTIAL>({
      ...streamTextOptions,
    } as any);
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
  const result = aiSdkStreamText<TOOLS, OUTPUT, OUTPUT_PARTIAL>({
    ...streamTextOptions,
    stopWhen: enhancedStopWhen,
  } as any);

  // For streaming, we need to wait for completion to check if synthesis is needed
  // This is more complex than the non-streaming version, so for now we return the enhanced stream
  // TODO: Implement post-stream synthesis for streaming responses

  return result;
}
