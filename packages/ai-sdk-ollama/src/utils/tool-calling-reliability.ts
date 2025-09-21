/**
 * Tool Calling Reliability Utilities for Ollama
 *
 * This module provides utilities to make Ollama tool calling more reliable
 * and deterministic. It addresses common issues like:
 * - Empty final text responses after tool execution
 * - Inconsistent parameter names
 * - Incomplete agent loops
 * - Tool result validation and recovery
 */

import {
  LanguageModelV2CallOptions,
  LanguageModelV2Content,
  LanguageModelV2FunctionTool,
  LanguageModelV2Prompt,
  LanguageModelV2ToolResultPart,
} from '@ai-sdk/provider';

const DEFAULT_TOOL_CALLING_OPTIONS: Required<
  Pick<
    ToolCallingOptions,
    'maxRetries' | 'forceCompletion' | 'normalizeParameters' | 'validateResults'
  >
> = {
  maxRetries: 2,
  forceCompletion: true,
  normalizeParameters: true,
  validateResults: true,
};

export interface ToolCallingOptions {
  /**
   * Maximum number of retry attempts for tool calls
   */
  maxRetries?: number;

  /**
   * Whether to force completion when tool calls succeed but no final text is generated
   */
  forceCompletion?: boolean;

  /**
   * Whether to normalize parameter names to handle inconsistencies
   */
  normalizeParameters?: boolean;

  /**
   * Whether to validate tool results and attempt recovery
   */
  validateResults?: boolean;

  /**
   * Custom parameter normalization mappings
   */
  parameterMappings?: Record<string, string[]>;

  /**
   * Timeout for tool execution in milliseconds
   */
  toolTimeout?: number;
}

export interface ResolvedToolCallingOptions
  extends Omit<
    ToolCallingOptions,
    'maxRetries' | 'forceCompletion' | 'normalizeParameters' | 'validateResults'
  > {
  maxRetries: number;
  forceCompletion: boolean;
  normalizeParameters: boolean;
  validateResults: boolean;
}

export function resolveToolCallingOptions(
  options?: ToolCallingOptions,
): ResolvedToolCallingOptions {
  return {
    ...DEFAULT_TOOL_CALLING_OPTIONS,
    ...options,
  } as ResolvedToolCallingOptions;
}

export interface ToolCallResult {
  success: boolean;
  result?: unknown;
  error?: string;
  normalizedInput?: Record<string, unknown>;
}

export interface ReliableToolCallResult {
  text: string;
  toolCalls: Array<{
    toolName: string;
    input: Record<string, unknown>;
  }>;
  toolResults?: Array<{
    toolName: string;
    input: Record<string, unknown>;
    normalizedInput?: Record<string, unknown>;
    result: unknown;
    success: boolean;
    error?: string;
  }>;
  completionMethod: 'natural' | 'forced' | 'incomplete';
  retryCount: number;
  errors?: string[];
}

export interface ToolDefinition {
  description: string;
  inputSchema: Record<string, unknown>;
  execute: (params: Record<string, unknown>) => Promise<unknown>;
}

function ensureRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

export function parseToolArguments(input: unknown): Record<string, unknown> {
  if (!input) {
    return {};
  }

  if (typeof input === 'string') {
    try {
      const parsed = JSON.parse(input);
      return ensureRecord(parsed);
    } catch (error) {
      console.warn('Failed to parse tool arguments as JSON:', error);
      return {};
    }
  }

  return ensureRecord(input);
}

export function createToolDefinitionMap(
  tools?: Array<LanguageModelV2FunctionTool>,
): Record<string, ToolDefinition> {
  if (!tools || tools.length === 0) {
    return {};
  }

  const result: Record<string, ToolDefinition> = {};
  for (const tool of tools) {
    // Skip tools that don't have an execute function
    if (
      typeof (tool as LanguageModelV2FunctionTool & { execute?: unknown })
        .execute !== 'function'
    ) {
      continue;
    }
    result[tool.name] = {
      description: tool.description ?? '',
      inputSchema:
        typeof tool.inputSchema === 'object' && tool.inputSchema
          ? (tool.inputSchema as Record<string, unknown>)
          : { type: 'object', properties: {} },
      execute: (
        tool as LanguageModelV2FunctionTool & {
          execute: (params: Record<string, unknown>) => Promise<unknown>;
        }
      ).execute,
    };
  }
  return result;
}

export function extractToolCallsFromContent(
  content: LanguageModelV2Content[],
): Array<{ toolName: string; input: Record<string, unknown> }> {
  return content
    .filter(
      (part): part is Extract<typeof part, { type: 'tool-call' }> =>
        part.type === 'tool-call',
    )
    .map((part) => ({
      toolName: part.toolName,
      input: parseToolArguments(part.input),
    }));
}

export function extractToolResultsFromPrompt(
  prompt: LanguageModelV2Prompt | undefined,
): Array<{ toolName: string; result: unknown; toolCallId?: string }> {
  if (!prompt || !Array.isArray(prompt)) {
    return [];
  }

  const results: Array<{
    toolName: string;
    result: unknown;
    toolCallId?: string;
  }> = [];

  for (const message of prompt) {
    if (message.role !== 'tool') {
      continue;
    }

    for (const part of message.content as Array<LanguageModelV2ToolResultPart>) {
      if (part.type !== 'tool-result') {
        continue;
      }

      const output = part.output;
      let value: unknown;

      switch (output.type) {
        case 'text':
        case 'error-text': {
          value = output.value;
          break;
        }
        case 'json':
        case 'error-json': {
          value = output.value;
          break;
        }
        case 'content': {
          value = output.value.map((item) =>
            item.type === 'text'
              ? { type: 'text', text: item.text }
              : {
                  type: 'media',
                  mediaType: item.mediaType,
                  data: item.data,
                },
          );
          break;
        }
        default: {
          value = output;
        }
      }

      results.push({
        toolName: part.toolName,
        toolCallId: part.toolCallId,
        result: value,
      });
    }
  }

  return results;
}

/**
 * Extract tool results from Ollama messages array
 * This is used to get tool results that the AI SDK has already executed
 */
export function extractToolResultsFromMessages(
  messages: Array<{ role: string; content: unknown }>,
): Array<{ toolName: string; result: unknown; toolCallId?: string }> {
  const results: Array<{
    toolName: string;
    result: unknown;
    toolCallId?: string;
  }> = [];

  for (const message of messages) {
    if (message.role !== 'tool') {
      continue;
    }

    // Handle different message content formats
    if (Array.isArray(message.content)) {
      for (const part of message.content) {
        if (
          part &&
          typeof part === 'object' &&
          'type' in part &&
          part.type === 'tool-result' &&
          'toolName' in part &&
          'output' in part
        ) {
          const toolResult = part as {
            toolName: string;
            output: unknown;
            toolCallId?: string;
          };
          results.push({
            toolName: toolResult.toolName,
            result: toolResult.output,
            toolCallId: toolResult.toolCallId,
          });
        }
      }
    } else if (message.content && typeof message.content === 'object') {
      // Handle single tool result object
      const content = message.content as {
        type?: string;
        toolName?: string;
        output?: unknown;
        toolCallId?: string;
      };
      if (
        content.type === 'tool-result' &&
        content.toolName &&
        content.output
      ) {
        results.push({
          toolName: content.toolName,
          result: content.output,
          toolCallId: content.toolCallId,
        });
      }
    }
  }

  return results;
}

async function runWithTimeout<T>(
  operation: () => Promise<T>,
  timeout?: number,
): Promise<T> {
  if (!timeout || timeout <= 0) {
    return operation();
  }

  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  try {
    const timeoutPromise = new Promise<T>((_, reject) => {
      timeoutId = setTimeout(() => {
        reject(new Error(`Tool execution timed out after ${timeout}ms`));
      }, timeout);
    });

    return await Promise.race<T>([operation(), timeoutPromise]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

/**
 * Default parameter mappings for common tool parameters
 */
const DEFAULT_PARAMETER_MAPPINGS: Record<string, string[]> = {
  location: ['location', 'city', 'q', 'place', 'location_name', 'loc'],
  unit: ['unit', 'temperature_unit', 'temp_unit', 'scale'],
  query: ['query', 'search', 'q', 'question'],
  expression: ['expression', 'math', 'calculation', 'formula'],
  flightNumber: ['flightNumber', 'flight_number', 'flight', 'flight_id'],
  date: ['date', 'time', 'datetime', 'timestamp'],
  amount: ['amount', 'value', 'quantity', 'number'],
  currency: ['currency', 'currency_code', 'code'],
};

/**
 * Normalize tool parameters to handle inconsistent naming from Ollama models
 */
export function normalizeToolParameters(
  input: unknown,
  mappings: Record<string, string[]> = DEFAULT_PARAMETER_MAPPINGS,
): Record<string, unknown> {
  const recordInput = ensureRecord(input);
  const normalized: Record<string, unknown> = {};

  // Apply parameter mappings
  for (const [standardName, variations] of Object.entries(mappings)) {
    for (const variation of variations) {
      if (
        recordInput[variation] !== undefined &&
        recordInput[variation] !== null
      ) {
        normalized[standardName] = recordInput[variation];
        break;
      }
    }
  }

  // Copy other parameters as-is
  for (const [key, value] of Object.entries(recordInput)) {
    if (!normalized[key] && value !== undefined && value !== null) {
      normalized[key] = value;
    }
  }

  return normalized;
}

/**
 * Validate tool result and attempt recovery if needed
 */
export async function validateToolResult(
  toolName: string,
  input: Record<string, unknown>,
  result: unknown,
  executeFunction: (params: Record<string, unknown>) => Promise<unknown>,
  options: ToolCallingOptions = {},
): Promise<ToolCallResult> {
  const { normalizeParameters = true, parameterMappings } = options;
  const normalizedInput = normalizeParameters
    ? normalizeToolParameters(input, parameterMappings)
    : input;

  // Check if result is valid
  if (
    !result ||
    (typeof result === 'object' && Object.keys(result).length === 0)
  ) {
    console.warn(
      `⚠️ Tool ${toolName} returned empty result, attempting recovery...`,
    );

    try {
      const recoveredResult = await executeFunction(normalizedInput);

      if (
        recoveredResult &&
        (typeof recoveredResult !== 'object' ||
          Object.keys(recoveredResult as Record<string, unknown>).length > 0)
      ) {
        return {
          success: true,
          result: recoveredResult,
          normalizedInput,
        };
      }
    } catch (error) {
      return {
        success: false,
        error: `Recovery failed: ${error instanceof Error ? error.message : String(error)}`,
        normalizedInput,
      };
    }

    return {
      success: false,
      error: 'Tool returned empty result and recovery failed',
      normalizedInput,
    };
  }

  return {
    success: true,
    result,
    normalizedInput: normalizeParameters ? normalizedInput : undefined,
  };
}

/**
 * Create a structured prompt that encourages better tool usage
 */
export function createStructuredToolPrompt(
  originalPrompt: string,
  tools: Record<string, ToolDefinition>,
): string {
  const toolDescriptions = Object.entries(tools)
    .map(([name, tool]) => `- ${name}: ${tool.description}`)
    .join('\n');

  return `You are a helpful assistant. To answer the user's question, you should use the available tools.

User Question: ${originalPrompt}

Available Tools:
${toolDescriptions}

Instructions:
1. Use the appropriate tool(s) to gather information
2. After using tools, provide a clear, comprehensive answer
3. Make sure to use the exact parameter names defined in the tool schema
4. Always provide a final text response after using tools

Please proceed with using the tools and then provide your answer.`;
}

/**
 * Execute tool calls with reliability improvements
 */
export async function executeReliableToolCalls(
  toolCalls: Array<{ toolName: string; input: unknown }>,
  tools: Record<string, ToolDefinition>,
  options: ToolCallingOptions = {},
): Promise<
  Array<{
    toolName: string;
    input: Record<string, unknown>;
    normalizedInput?: Record<string, unknown>;
    result: unknown;
    success: boolean;
    error?: string;
  }>
> {
  const {
    validateResults = true,
    normalizeParameters = true,
    parameterMappings,
    toolTimeout,
  } = options;
  const results: Array<{
    toolName: string;
    input: Record<string, unknown>;
    normalizedInput?: Record<string, unknown>;
    result: unknown;
    success: boolean;
    error?: string;
  }> = [];

  for (const toolCall of toolCalls) {
    if (!toolCall || !tools[toolCall.toolName]) {
      results.push({
        toolName: toolCall?.toolName || 'unknown',
        input: (toolCall?.input as Record<string, unknown>) || {},
        result: null,
        success: false,
        error: 'Tool not found or invalid tool call',
      });
      continue;
    }

    try {
      const tool = tools[toolCall.toolName];
      if (!tool) {
        results.push({
          toolName: toolCall.toolName,
          input: {},
          result: null,
          success: false,
          error: 'Tool not found',
        });
        continue;
      }

      const parsedInput = parseToolArguments(toolCall.input);
      const normalizedInput = normalizeParameters
        ? normalizeToolParameters(parsedInput, parameterMappings)
        : parsedInput;

      const result = await runWithTimeout(
        () => (tool as ToolDefinition).execute(normalizedInput),
        toolTimeout,
      );

      // Validate result if requested
      if (validateResults) {
        const validation = await validateToolResult(
          toolCall.toolName,
          normalizedInput,
          result,
          (tool as ToolDefinition).execute,
          options,
        );

        results.push({
          toolName: toolCall.toolName,
          input: parsedInput,
          normalizedInput: validation.normalizedInput ?? normalizedInput,
          result: validation.result,
          success: validation.success,
          error: validation.error,
        });
      } else {
        results.push({
          toolName: toolCall.toolName,
          input: parsedInput,
          result,
          success: true,
        });
      }
    } catch (error) {
      results.push({
        toolName: toolCall.toolName,
        input: parseToolArguments(toolCall.input),
        result: null,
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return results;
}

/**
 * Force completion by generating a follow-up response with tool results
 */
export async function forceCompletion(
  model: {
    doGenerate: (
      options: LanguageModelV2CallOptions,
    ) => Promise<{ content: LanguageModelV2Content[] }>;
  },
  originalPrompt: string,
  toolResults: Array<{ toolName: string; result: unknown }>,
  options: Omit<LanguageModelV2CallOptions, 'prompt'> = {},
): Promise<string> {
  const expectsJson = options.responseFormat?.type === 'json';
  const finalInstruction = expectsJson
    ? 'Return the final answer as JSON that satisfies the requested schema.'
    : 'Please provide a clear, helpful response that incorporates this information.';

  const followUpPrompt = `Based on the following tool results, please provide a comprehensive response to the original question: "${originalPrompt}"

Tool Results:
${toolResults.map((tr) => `${tr.toolName}: ${JSON.stringify(tr.result)}`).join('\n')}

${finalInstruction}`;

  const result = await model.doGenerate({
    ...options,
    prompt: [
      {
        role: 'user',
        content: [{ type: 'text', text: followUpPrompt }],
      },
    ],
    // Don't provide tools for the follow-up to avoid recursion
  });

  // Extract text content from the result
  const textContent = result.content.find((c) => c.type === 'text');
  return textContent?.text || '';
}

/**
 * Main function for reliable tool calling with Ollama
 */
export async function reliableToolCall(
  model: {
    doGenerate: (options: LanguageModelV2CallOptions) => Promise<{
      content: LanguageModelV2Content[];
      toolCalls?: Array<{ toolName: string; input: Record<string, unknown> }>;
    }>;
  },
  options: LanguageModelV2CallOptions & {
    tools?: Record<string, ToolDefinition>;
  },
  reliabilityOptions: ToolCallingOptions = {},
): Promise<ReliableToolCallResult> {
  const { maxRetries = 3, forceCompletion: shouldForceCompletion = true } =
    reliabilityOptions;

  const { tools = {}, prompt } = options;
  const errors: string[] = [];
  let retryCount = 0;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    retryCount = attempt;

    try {
      // Create structured prompt if tools are provided
      const finalPrompt =
        tools && Object.keys(tools).length > 0
          ? createStructuredToolPrompt(
              typeof prompt === 'string' ? prompt : JSON.stringify(prompt),
              tools,
            )
          : prompt;

      // Make the initial call
      const result = await model.doGenerate({
        ...options,
        prompt:
          typeof finalPrompt === 'string'
            ? [
                {
                  role: 'user',
                  content: [{ type: 'text', text: finalPrompt }],
                },
              ]
            : finalPrompt,
      });

      // Check if we got tool calls but no final response
      const textContent = result.content.find((c) => c.type === 'text');
      const hasText = textContent?.text && textContent.text.length > 0;
      const toolCallsFromContent = extractToolCallsFromContent(result.content);
      const toolCallsToUse =
        result.toolCalls && result.toolCalls.length > 0
          ? result.toolCalls
          : toolCallsFromContent;

      if (toolCallsToUse.length > 0 && !hasText && shouldForceCompletion) {
        // Execute tools and force completion
        const toolResults = await executeReliableToolCalls(
          toolCallsToUse,
          tools,
          reliabilityOptions,
        );

        const completionText = await forceCompletion(
          model,
          typeof prompt === 'string' ? prompt : JSON.stringify(prompt),
          toolResults,
          options,
        );

        return {
          text: completionText,
          toolCalls: toolCallsToUse,
          toolResults,
          completionMethod: 'forced',
          retryCount,
          errors,
        };
      }

      // If we got a good response, return it
      if (hasText) {
        return {
          text: textContent.text,
          toolCalls: toolCallsToUse,
          completionMethod: 'natural',
          retryCount,
          errors,
        };
      }

      // If this is the last attempt, return what we have
      if (attempt === maxRetries) {
        return {
          text: textContent?.text || '',
          toolCalls: toolCallsToUse,
          completionMethod: 'incomplete',
          retryCount,
          errors,
        };
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      errors.push(`Attempt ${attempt}: ${errorMessage}`);

      if (attempt === maxRetries) {
        throw error;
      }
    }
  }

  // This should never be reached, but TypeScript requires it
  throw new Error('Maximum retry attempts exceeded');
}

/**
 * Enhanced tool calling wrapper that can be used as a drop-in replacement
 */
export function createReliableToolCallWrapper(
  model: {
    doGenerate: (options: LanguageModelV2CallOptions) => Promise<{
      content: LanguageModelV2Content[];
      toolCalls?: Array<{ toolName: string; input: Record<string, unknown> }>;
    }>;
  },
  reliabilityOptions: ToolCallingOptions = {},
) {
  return async (
    options: LanguageModelV2CallOptions & {
      tools?: Record<string, ToolDefinition>;
    },
  ) => {
    return await reliableToolCall(model, options, reliabilityOptions);
  };
}
