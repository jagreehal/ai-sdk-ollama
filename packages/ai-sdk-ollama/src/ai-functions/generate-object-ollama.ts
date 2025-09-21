/**
 * generateObject with improved reliability for Ollama tool calling
 *
 * This utility provides a wrapper around the AI SDK's generateObject function
 * that implements better stop conditions, response synthesis, and object generation
 * reliability for Ollama models.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { generateObject as aiSdkGenerateObject } from 'ai';
import type {
  LanguageModel,
  StepResult,
  GenerateObjectResult,
  CallSettings,
  Prompt,
} from 'ai';
import { JSONValue } from '@ai-sdk/provider';
import { InferSchema, Schema } from '@ai-sdk/provider-utils';
import * as z3 from 'zod/v3';
import * as z4 from 'zod/v4';
import {
  createReliableObjectGeneration,
  type ObjectGenerationOptions,
} from '../utils/object-generation-reliability';

export interface GenerateObjectOllamaOptions {
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

  /**
   * Object generation reliability options
   */
  objectReliabilityOptions?: ObjectGenerationOptions;
}

/**
 * Enhanced generateObject function with improved reliability for Ollama
 */
export async function generateObjectOllama<
  SCHEMA extends
    | z3.Schema
    | z4.core.$ZodType
    | Schema = z4.core.$ZodType<JSONValue>,
  OUTPUT extends
    | 'object'
    | 'array'
    | 'enum'
    | 'no-schema' = InferSchema<SCHEMA> extends string ? 'enum' : 'object',
  RESULT = OUTPUT extends 'array'
    ? Array<InferSchema<SCHEMA>>
    : InferSchema<SCHEMA>,
>(
  options: Omit<CallSettings, 'stopSequences'> &
    Prompt &
    (OUTPUT extends 'enum'
      ? {
          enum: Array<RESULT>;
          mode?: 'json';
          output: 'enum';
        }
      : OUTPUT extends 'no-schema'
        ? object
        : {
            schema: SCHEMA;
            schemaName?: string;
            schemaDescription?: string;
            mode?: 'auto' | 'json' | 'tool';
          }) & {
      model: LanguageModel;
      output?: OUTPUT;
      experimental_repairText?: any;
      experimental_telemetry?: any;
      experimental_download?: any;
      providerOptions?: any;
      _internal?: {
        generateId?: () => string;
        currentDate?: () => Date;
      };
    } & {
      enhancedOptions?: GenerateObjectOllamaOptions;
    },
): Promise<
  GenerateObjectResult<RESULT> & {
    success: boolean;
    retryCount: number;
    errors?: string[];
    recoveryMethod?: string;
  }
> {
  const { enhancedOptions = {}, ...generateObjectOptions } = options;
  const {
    enableReliability = true,
    maxSteps = 5,
    minResponseLength = 10,
    enableSynthesis = true,
    synthesisPrompt = 'Please provide a comprehensive response based on the tool results above.',
    maxSynthesisAttempts = 2,
    objectReliabilityOptions = {},
  } = enhancedOptions;

  if (!enableReliability) {
    const result = await aiSdkGenerateObject<SCHEMA, OUTPUT, RESULT>({
      ...generateObjectOptions,
    } as any);
    return {
      ...result,
      success: true,
      retryCount: 1,
      recoveryMethod: 'natural' as const,
    };
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

  // Create a reliable object generation wrapper
  const reliableGenerator = createReliableObjectGeneration(
    async (genOptions: Record<string, unknown>) => {
      const result = await aiSdkGenerateObject<SCHEMA, OUTPUT, RESULT>({
        ...generateObjectOptions,
        ...genOptions,
        stopWhen: enhancedStopWhen,
      } as any);
      return { object: result.object };
    },
    (generateObjectOptions as any).schema,
    {
      maxRetries: 3,
      attemptRecovery: true,
      useFallbacks: true,
      fixTypeMismatches: true,
      enableTextRepair: true,
      ...objectReliabilityOptions,
    },
  );

  // First attempt with enhanced stop conditions and object reliability
  let result: GenerateObjectResult<any>;
  let reliabilityResult: {
    object: any;
    success: boolean;
    retryCount: number;
    errors?: string[];
    recoveryMethod?: string;
  };

  try {
    reliabilityResult = await reliableGenerator({});

    // Get the full result by calling the AI SDK again with the reliable object
    result = await aiSdkGenerateObject<SCHEMA, OUTPUT, RESULT>({
      ...generateObjectOptions,
      stopWhen: enhancedStopWhen,
    } as any);

    // Replace the object with the reliable one
    result = {
      ...result,
      object: reliabilityResult.object,
    };
  } catch (error) {
    console.warn(
      '🔧 Object generation reliability failed, falling back to standard generation:',
      error,
    );

    // Fallback to standard generation
    result = await aiSdkGenerateObject<SCHEMA, OUTPUT, RESULT>({
      ...generateObjectOptions,
      stopWhen: enhancedStopWhen,
    } as any);

    reliabilityResult = {
      object: result.object,
      success: false,
      retryCount: 1,
      errors: [error instanceof Error ? error.message : String(error)],
    };
  }

  // Check if we need synthesis (tools were called but no meaningful text response)
  if (enableSynthesis && needsSynthesis(result, minResponseLength)) {
    console.log('🔧 Applying synthesis step for object generation...');

    for (let attempt = 1; attempt <= maxSynthesisAttempts; attempt++) {
      try {
        // Build a conversation history that includes the original prompt and tool results
        const originalPrompt =
          typeof generateObjectOptions.prompt === 'string'
            ? generateObjectOptions.prompt
            : generateObjectOptions.messages?.at(-1)?.content ||
              'the user question';

        // Create a synthesis prompt that includes context
        const toolResultsText = '';

        const fullSynthesisPrompt = `You previously called tools to gather information for object generation. Here's what happened:

Original request: ${originalPrompt}

Tool results:
${toolResultsText}

${synthesisPrompt}

Please ensure your response includes both the requested object structure and explanatory text.`;

        // Run synthesis for object generation with reliability
        const synthesisReliabilityResult = await reliableGenerator({
          prompt: fullSynthesisPrompt,
        });

        const synthesisResult = await aiSdkGenerateObject<
          SCHEMA,
          OUTPUT,
          RESULT
        >({
          ...generateObjectOptions,
          prompt: fullSynthesisPrompt,
          stopWhen: [
            ({ steps }: { steps: StepResult<any>[] }) => steps.length > 0,
          ],
        } as any);

        if (
          (synthesisResult as any).text &&
          (synthesisResult as any).text.trim().length >= minResponseLength
        ) {
          console.log(`🔧 Object synthesis successful on attempt ${attempt}`);

          // Return enhanced result with reliable object
          return {
            ...result,
            object: synthesisReliabilityResult.object,
            // Combine usage information
            usage: {
              inputTokens:
                (result.usage.inputTokens || 0) +
                ((synthesisResult as any).usage.inputTokens || 0),
              outputTokens:
                (result.usage.outputTokens || 0) +
                ((synthesisResult as any).usage.outputTokens || 0),
              totalTokens:
                (result.usage.totalTokens || 0) +
                ((synthesisResult as any).usage.totalTokens || 0),
            },
            // Add reliability metadata
            success: synthesisReliabilityResult.success,
            retryCount: synthesisReliabilityResult.retryCount,
            errors: synthesisReliabilityResult.errors,
            recoveryMethod: synthesisReliabilityResult.recoveryMethod,
          };
        }
      } catch (error) {
        console.warn(`🔧 Object synthesis attempt ${attempt} failed:`, error);
      }
    }

    console.log(
      '🔧 All object synthesis attempts failed, returning original result',
    );
  }

  // Return result with reliability metadata
  return {
    ...result,
    success: reliabilityResult.success,
    retryCount: reliabilityResult.retryCount,
    errors: reliabilityResult.errors,
    recoveryMethod: reliabilityResult.recoveryMethod,
  };
}

/**
 * Check if a result needs synthesis (has tool results but poor text response)
 */
function needsSynthesis(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _result: GenerateObjectResult<any>,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _minResponseLength: number,
): boolean {
  // For object generation, we don't need synthesis based on text length
  // since we're generating objects, not text
  return false;
}
