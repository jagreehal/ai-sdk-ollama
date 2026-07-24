import {
  LanguageModelV4CallOptions,
  LanguageModelV4FunctionTool,
  LanguageModelV4Prompt,
  LanguageModelV4ProviderTool,
  LanguageModelV4TextPart,
  SharedV4Warning,
} from '@ai-sdk/provider';
import { Message as OllamaMessage, Tool } from 'ollama';
import { OllamaChatSettings } from '../provider';
import { convertToOllamaChatMessages } from '../utils/convert-to-ollama-messages';

/**
 * The effective Ollama `think` value for a request, derived from the canonical
 * Ollama `ChatRequest['think']` contract (`boolean | 'high' | 'medium' | 'low'`).
 */
export type OllamaThink = OllamaChatSettings['think'];

export type OllamaCallOptions = {
  messages: OllamaMessage[];
  options: Record<string, unknown>;
  format?: string | Record<string, unknown>;
  tools?: Tool[];
  warnings: SharedV4Warning[];
  keep_alive?: string | number;
};

const EMPTY_OBJECT_SCHEMA = {
  type: 'object',
  properties: {},
  additionalProperties: false,
} as const;

/**
 * Whether structured outputs should be enabled for this call.
 *
 * A JSON schema always forces them on, so `generateObject` / `Output.object()`
 * work without the caller opting in; otherwise the model setting decides.
 */
export function shouldEnableStructuredOutputs(
  settings: OllamaChatSettings,
  options: LanguageModelV4CallOptions,
): boolean {
  if (
    options.responseFormat?.type === 'json' &&
    options.responseFormat.schema
  ) {
    if (settings.structuredOutputs === false) {
      console.warn(
        'Ollama: structuredOutputs was set to false but auto-enabled for object generation. ' +
          'This ensures generateText with Output.object() and streamText with Output.object() work correctly.',
      );
    }
    return true;
  }

  return settings.structuredOutputs ?? false;
}

function toOllamaTool(
  tool: LanguageModelV4FunctionTool | LanguageModelV4ProviderTool,
): Tool {
  if (tool.type !== 'function') {
    throw new Error(
      `Provider-defined tools are not supported by Ollama. Use function tools instead.`,
    );
  }

  // Tools reach providers as JSON schema. Anything else we cannot translate,
  // so fall back to an empty object schema rather than sending garbage.
  const { inputSchema } = tool;

  if (!inputSchema || typeof inputSchema !== 'object') {
    return functionTool(tool.name, tool.description, EMPTY_OBJECT_SCHEMA);
  }

  if ('parse' in inputSchema && typeof inputSchema.parse === 'function') {
    console.warn(
      `Tool ${tool.name} is using a Zod schema directly. Schema conversion may not work properly due to Zod version mismatch.`,
    );
    return functionTool(tool.name, tool.description, EMPTY_OBJECT_SCHEMA);
  }

  const isJsonSchema = 'properties' in inputSchema || 'type' in inputSchema;

  return functionTool(
    tool.name,
    tool.description,
    isJsonSchema
      ? (inputSchema as Record<string, unknown>)
      : EMPTY_OBJECT_SCHEMA,
  );
}

function functionTool(
  name: string,
  description: string | undefined,
  parameters: Record<string, unknown>,
): Tool {
  return { type: 'function', function: { name, description, parameters } };
}

/**
 * Map AI SDK call options onto Ollama's request shape.
 *
 * Precedence: AI SDK parameters are mapped to their Ollama equivalents first,
 * then the model's own `options` win, so callers can reach settings the AI SDK
 * does not model.
 */
export function getCallOptions(
  settings: OllamaChatSettings,
  options: LanguageModelV4CallOptions,
): OllamaCallOptions {
  const {
    prompt,
    temperature,
    maxOutputTokens,
    topP,
    topK,
    frequencyPenalty,
    presencePenalty,
    stopSequences,
    seed,
    responseFormat,
    tools,
  } = options;

  const needsStructuredOutputs = shouldEnableStructuredOutputs(
    settings,
    options,
  );

  if (
    responseFormat?.type === 'json' &&
    responseFormat.schema &&
    !needsStructuredOutputs
  ) {
    throw new Error(
      'JSON schema is only supported when structuredOutputs is enabled',
    );
  }

  const ollamaOptions: Record<string, unknown> = {
    ...(temperature !== undefined && { temperature }),
    ...(maxOutputTokens !== undefined && { num_predict: maxOutputTokens }),
    ...(topP !== undefined && { top_p: topP }),
    ...(topK !== undefined && { top_k: topK }),
    ...(frequencyPenalty !== undefined && {
      frequency_penalty: frequencyPenalty,
    }),
    ...(presencePenalty !== undefined && { presence_penalty: presencePenalty }),
    ...(stopSequences !== undefined && { stop: stopSequences }),
    ...(seed !== undefined && { seed }),
    ...settings.options,
  };

  for (const key of Object.keys(ollamaOptions)) {
    if (ollamaOptions[key] === undefined) {
      delete ollamaOptions[key];
    }
  }

  let format: string | Record<string, unknown> | undefined;
  if (responseFormat?.type === 'json') {
    if (responseFormat.schema && needsStructuredOutputs) {
      const schema = { ...(responseFormat.schema as Record<string, unknown>) };
      delete schema.$schema; // Ollama rejects the `$schema` key
      format = cleanSchemaForOllama(schema);
    } else {
      format = 'json';
    }
  }

  return {
    messages: convertToOllamaChatMessages(prompt),
    options: ollamaOptions,
    format,
    tools: tools?.map((tool) => toOllamaTool(tool)),
    warnings: [],
    keep_alive: settings.keep_alive,
  };
}

/** The most recent user turn, as already-converted Ollama messages. */
export function getLatestUserMessage(messages: OllamaMessage[]): string {
  for (let index = messages.length - 1; index >= 0; index--) {
    const message = messages[index];
    if (message?.role === 'user' && typeof message.content === 'string') {
      return message.content;
    }
  }

  return '';
}

/** The most recent user turn, read from the original AI SDK prompt. */
export function getLatestUserPromptText(
  prompt: LanguageModelV4Prompt | undefined,
): string {
  for (let index = (prompt?.length ?? 0) - 1; index >= 0; index--) {
    const message = prompt?.[index];

    if (message?.role !== 'user') {
      continue;
    }

    if (typeof message.content === 'string') {
      return message.content;
    }

    const textParts = message.content.filter(
      (part): part is LanguageModelV4TextPart => part.type === 'text',
    );

    if (textParts.length > 0) {
      return textParts.map((part) => part.text).join('\n');
    }
  }

  return '';
}

/**
 * Resolve the effective Ollama `think` value for a request.
 *
 * AI SDK v7 adds a per-call `reasoning` effort option to
 * `LanguageModelV4CallOptions`. We map it onto Ollama's `think` parameter
 * (`boolean | 'high' | 'medium' | 'low'`):
 *
 * - `'none'`                     -> `false`
 * - `'minimal'` / `'low'`        -> `'low'`
 * - `'medium'`                   -> `'medium'`
 * - `'high'` / `'xhigh'`         -> `'high'`
 * - `'provider-default'` / unset -> fall back to the `think` provider setting
 *
 * The per-call `reasoning` option takes precedence over the model-level
 * `think` setting, so reasoning effort can vary per request.
 */
export function resolveThink(
  settings: OllamaChatSettings,
  options: LanguageModelV4CallOptions,
): OllamaThink {
  switch (options.reasoning) {
    case 'none': {
      return false;
    }
    case 'minimal':
    case 'low': {
      return 'low';
    }
    case 'medium': {
      return 'medium';
    }
    case 'high':
    case 'xhigh': {
      return 'high';
    }
    // 'provider-default', undefined, or any future value: use the model setting.
    default: {
      return settings.think;
    }
  }
}

/**
 * Assemble the common Ollama chat request envelope shared by every
 * `client.chat()` call (generate, streaming, tool/object reliability,
 * forced completion). Callers add the `stream: true | false` literal at the
 * call site so the Ollama client's streaming overload still resolves.
 */
export function buildChatRequest(parameters: {
  modelId: string;
  messages: OllamaMessage[];
  options: Record<string, unknown>;
  format?: string | Record<string, unknown>;
  tools?: Tool[];
  keep_alive?: string | number;
  think?: OllamaThink;
}) {
  const { modelId, messages, options, format, tools, keep_alive, think } =
    parameters;

  return {
    model: modelId,
    messages,
    options,
    format,
    ...(tools !== undefined && { tools }),
    ...(keep_alive !== undefined && { keep_alive }),
    ...(think !== undefined && { think }),
  };
}

/**
 * Strip regex patterns Ollama's schema engine cannot compile — they surface as
 * opaque "fetch failed" errors. Everything else is preserved.
 */
export function cleanSchemaForOllama(
  schema: Record<string, unknown>,
): Record<string, unknown> {
  if (typeof schema !== 'object' || schema === null) {
    return schema;
  }

  const cleaned = { ...schema };

  if (cleaned.properties && typeof cleaned.properties === 'object') {
    const cleanedProperties: Record<string, unknown> = {};

    for (const [key, property] of Object.entries(
      cleaned.properties as Record<string, unknown>,
    )) {
      if (typeof property !== 'object' || property === null) {
        cleanedProperties[key] = property;
        continue;
      }

      const cleanedProperty = { ...(property as Record<string, unknown>) };
      const { format, pattern } = cleanedProperty;

      // `format: 'email'` already validates; its pattern is the common offender.
      if (
        (format === 'email' && pattern) ||
        (typeof pattern === 'string' && pattern.length > 50)
      ) {
        delete cleanedProperty.pattern;
      }

      cleanedProperties[key] = cleanSchemaForOllama(cleanedProperty);
    }

    cleaned.properties = cleanedProperties;
  }

  for (const [key, value] of Object.entries(cleaned)) {
    if (
      key !== 'properties' &&
      typeof value === 'object' &&
      value !== null &&
      !Array.isArray(value)
    ) {
      cleaned[key] = cleanSchemaForOllama(value as Record<string, unknown>);
    }
  }

  return cleaned;
}
