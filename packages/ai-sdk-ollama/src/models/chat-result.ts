import {
  JSONObject,
  JSONValue,
  LanguageModelV4Content,
  LanguageModelV4FinishReason,
  LanguageModelV4Usage,
  SharedV4ProviderMetadata,
  SharedV4Warning,
} from '@ai-sdk/provider';
import { ChatResponse, Message as OllamaMessage, Tool, ToolCall } from 'ollama';
import { mapOllamaFinishReason } from '../utils/map-ollama-finish-reason';
import {
  executeReliableToolCalls,
  parseToolArguments,
  type ReliableToolCallResult,
} from '../utils/tool-calling-reliability';

export type GenerateResult = {
  content: LanguageModelV4Content[];
  finishReason: LanguageModelV4FinishReason;
  usage: LanguageModelV4Usage;
  providerMetadata?: SharedV4ProviderMetadata;
  request?: { body?: unknown };
  response?: { id?: string; timestamp?: Date; modelId?: string };
  warnings: SharedV4Warning[];
};

export interface ParsedToolCall {
  toolName: string;
  input: Record<string, unknown>;
  rawInput: unknown;
}

/**
 * Parse Ollama tool calls into a normalized format.
 * Uses the ToolCall type from the Ollama library for type safety.
 */
export function parseOllamaToolCalls(
  toolCalls: ToolCall[] | undefined,
): ParsedToolCall[] {
  if (!toolCalls || toolCalls.length === 0) {
    return [];
  }

  const parsed: ParsedToolCall[] = [];

  for (const call of toolCalls) {
    const toolName = call?.function?.name;
    if (!toolName) {
      continue;
    }

    const rawInput = call.function?.arguments ?? {};
    const input = parseToolArguments(rawInput);

    parsed.push({
      toolName,
      input,
      rawInput,
    });
  }

  return parsed;
}

export function buildContent(
  reasoning: string | undefined,
  includeReasoning: boolean,
  text: string | undefined,
  toolCalls: ParsedToolCall[],
): LanguageModelV4Content[] {
  const content: LanguageModelV4Content[] = [];

  if (reasoning && includeReasoning) {
    content.push({ type: 'reasoning', text: reasoning });
  }

  if (text && text.length > 0) {
    content.push({ type: 'text', text });
  }

  for (const toolCall of toolCalls) {
    content.push({
      type: 'tool-call',
      toolCallId: crypto.randomUUID(),
      toolName: toolCall.toolName,
      input: JSON.stringify(toolCall.input ?? {}),
    });
  }

  return content;
}

/** Ollama's own counters and nanosecond timings, surfaced on `usage.raw`. */
const OLLAMA_USAGE_FIELDS = [
  'prompt_eval_count',
  'eval_count',
  'total_duration',
  'load_duration',
  'prompt_eval_duration',
  'eval_duration',
] as const;

/** Per-call timings Ollama reports; the counters above belong on `usage.raw`. */
const OLLAMA_DURATION_FIELDS = [
  'total_duration',
  'load_duration',
  'eval_duration',
] as const;

/**
 * Response fields shared by every `providerMetadata.ollama` payload. Callers
 * add their own keys (reliability details, etc.) on top.
 */
export function ollamaResponseDetails(
  response: ChatResponse,
): Record<string, JSONValue> {
  const details: Record<string, JSONValue> = { model: response.model };

  if (response.created_at) {
    details.created_at = new Date(response.created_at).toISOString();
  }

  for (const field of OLLAMA_DURATION_FIELDS) {
    const value = response[field];
    if (value !== undefined) {
      details[field] = value;
    }
  }

  return details;
}

/**
 * Create a LanguageModelV4Usage object from token counts.
 * V4 uses structured objects for inputTokens and outputTokens.
 */
export function createUsage(
  inputTokenCount?: number,
  outputTokenCount?: number,
  raw?: JSONObject,
): LanguageModelV4Usage {
  return {
    inputTokens: {
      total: inputTokenCount,
      noCache: inputTokenCount,
      cacheRead: undefined,
      cacheWrite: undefined,
    },
    outputTokens: {
      total: outputTokenCount,
      text: outputTokenCount,
      reasoning: undefined,
    },
    raw,
  };
}

/**
 * Usage for a model call, summed across the responses that made it up. Token
 * counts feed the normalised fields; every Ollama counter and timing is also
 * summed onto `usage.raw` so callers can read the provider's own shape.
 */
export function aggregateUsage(
  ...responses: ChatResponse[]
): LanguageModelV4Usage {
  const raw: Record<string, number> = {};

  for (const response of responses) {
    for (const field of OLLAMA_USAGE_FIELDS) {
      const value = response?.[field];
      if (typeof value === 'number') {
        raw[field] = (raw[field] ?? 0) + value;
      }
    }
  }

  return createUsage(
    raw.prompt_eval_count,
    raw.eval_count,
    Object.keys(raw).length > 0 ? raw : undefined,
  );
}

/**
 * The request body echoed back on a result. Ollama's client takes the same
 * shape, so this mirrors what was actually sent.
 */
function requestBody(parameters: {
  modelId: string;
  messages: OllamaMessage[];
  ollamaOptions: Record<string, unknown>;
  format?: string | Record<string, unknown>;
  tools?: Tool[];
  keep_alive?: string | number;
}): Record<string, unknown> {
  return {
    model: parameters.modelId,
    messages: parameters.messages,
    options: parameters.ollamaOptions,
    format: parameters.format,
    tools: parameters.tools,
    ...(parameters.keep_alive !== undefined && {
      keep_alive: parameters.keep_alive,
    }),
  };
}

export function buildGenerationResult(parameters: {
  modelId: string;
  messages: OllamaMessage[];
  ollamaOptions: Record<string, unknown>;
  format?: string | Record<string, unknown>;
  ollamaTools?: Tool[];
  warnings: SharedV4Warning[];
  response: ChatResponse;
  followUpResponse?: ChatResponse;
  parsedToolCalls: ParsedToolCall[];
  completionMethod: ReliableToolCallResult['completionMethod'];
  retryCount: number;
  errors: string[];
  toolResults?: Awaited<ReturnType<typeof executeReliableToolCalls>>;
  reliable: boolean;
  finalTextOverride?: string;
  keep_alive?: string | number;
  think?: boolean | 'low' | 'medium' | 'high';
}): GenerateResult {
  const {
    modelId,
    messages,
    ollamaOptions,
    format,
    ollamaTools,
    warnings,
    response,
    followUpResponse,
    parsedToolCalls,
    completionMethod,
    retryCount,
    errors,
    toolResults,
    reliable,
    finalTextOverride,
    keep_alive,
    think,
  } = parameters;

  const finalText = finalTextOverride ?? response.message.content ?? '';

  const content = buildContent(
    response.message.thinking,
    Boolean(think),
    finalText,
    parsedToolCalls,
  );

  const finishSource = followUpResponse ?? response;

  const usage = followUpResponse
    ? aggregateUsage(response, followUpResponse)
    : aggregateUsage(response);

  // `mapOllamaFinishReason` already defaults a missing reason to `stop`.
  const finishReason = mapOllamaFinishReason(
    finishSource.done_reason,
    parsedToolCalls.length > 0,
  );

  const providerDetails = ollamaResponseDetails(finishSource);

  providerDetails.reliable_tool_calling = reliable;
  if (reliable) {
    providerDetails.completion_method = completionMethod;
    providerDetails.retry_count = retryCount;
    if (errors.length > 0) {
      providerDetails.reliability_errors = errors;
    }
    if (toolResults && toolResults.length > 0) {
      providerDetails.tool_results = toolResults.map((result) => {
        const toolResult: Record<string, unknown> = {
          toolName: result.toolName,
          success: result.success,
        };
        if (result.error !== undefined) {
          toolResult.error = result.error;
        }
        return toolResult as JSONValue;
      });
    }
  }

  return {
    content,
    finishReason,
    usage,
    providerMetadata: { ollama: providerDetails },
    request: {
      body: {
        ...requestBody({
          modelId,
          messages,
          ollamaOptions,
          format,
          tools: ollamaTools,
          keep_alive,
        }),
        ...(reliable && { reliable_tool_calling: true }),
      },
    },
    response: {
      timestamp: new Date(),
      modelId,
    },
    warnings,
  };
}

export function buildObjectGenerationResult(parameters: {
  modelId: string;
  messages: OllamaMessage[];
  ollamaOptions: Record<string, unknown>;
  format?: string | Record<string, unknown>;
  tools?: Tool[];
  warnings: SharedV4Warning[];
  response: ChatResponse;
  text: string;
  recoveryMethod: 'natural' | 'retry' | 'fallback' | 'type_fix' | 'text_repair';
  retryCount: number;
  errors?: string[];
  keep_alive?: string | number;
}): GenerateResult {
  const {
    modelId,
    messages,
    ollamaOptions,
    format,
    tools,
    warnings,
    response,
    text,
    recoveryMethod,
    retryCount,
    errors,
    keep_alive,
  } = parameters;

  const providerDetails: Record<string, JSONValue> = {
    ...ollamaResponseDetails(response),
    reliable_object_generation: true,
    recovery_method: recoveryMethod,
    retry_count: retryCount,
  };

  if (errors && errors.length > 0) {
    providerDetails.reliability_errors = errors;
  }

  return {
    // For object generation we return the validated text as content.
    content: [{ type: 'text', text }],
    finishReason: mapOllamaFinishReason(response.done_reason),
    usage: aggregateUsage(response),
    providerMetadata: { ollama: providerDetails },
    request: {
      body: {
        ...requestBody({
          modelId,
          messages,
          ollamaOptions,
          format,
          tools,
          keep_alive,
        }),
        reliable_object_generation: true,
      },
    },
    response: {
      timestamp: new Date(),
      modelId,
    },
    warnings,
  };
}
