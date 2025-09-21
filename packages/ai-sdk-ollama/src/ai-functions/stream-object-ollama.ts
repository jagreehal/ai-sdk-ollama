/**
 * streamObject with improved reliability for Ollama tool calling
 *
 * This utility provides a wrapper around the AI SDK's streamObject function
 * that implements better stop conditions and response synthesis for Ollama models.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { streamObject as aiSdkStreamObject } from 'ai';
import type { StepResult } from 'ai';

export interface StreamObjectOllamaOptions {
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
 * Enhanced streamObject function with improved reliability for Ollama
 */
export async function streamObjectOllama(
  options: Parameters<typeof aiSdkStreamObject>[0] & {
    enhancedOptions?: StreamObjectOllamaOptions;
  },
): Promise<any> {
  const { enhancedOptions = {}, ...streamObjectOptions } = options;
  const {
    enableReliability = true,
    maxSteps = 5,
    minResponseLength = 10,
  } = enhancedOptions;

  if (!enableReliability) {
    return aiSdkStreamObject({
      ...streamObjectOptions,
    } as any);
  }

  // Enhanced stop conditions that ensure proper completion
  const enhancedStopWhen = [
    // Stop if we exceed max steps
    ({ steps }: { steps: StepResult<any>[] }) => steps.length >= maxSteps,

    // Stop if we have a good text response (with or without tools)
    ({ steps }: { steps: StepResult<any>[] }) => {
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
  const result = aiSdkStreamObject({
    ...streamObjectOptions,
    stopWhen: enhancedStopWhen,
  } as any);

  // For streaming objects, we need to wait for completion to check if synthesis is needed
  // This is more complex than the non-streaming version, so for now we return the enhanced stream
  // TODO: Implement post-stream synthesis for streaming object responses with object reliability

  return result;
}
