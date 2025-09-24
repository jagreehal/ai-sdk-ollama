import {
  LanguageModelV2,
  LanguageModelV2CallOptions,
  LanguageModelV2CallWarning,
  LanguageModelV2FinishReason,
  LanguageModelV2StreamPart,
  LanguageModelV2Usage,
  LanguageModelV2Content,
  JSONValue,
  LanguageModelV2FunctionTool,
  LanguageModelV2Prompt,
  LanguageModelV2TextPart,
  JSONSchema7,
} from '@ai-sdk/provider';
import { Ollama, Message as OllamaMessage, ChatResponse, Tool } from 'ollama';
import { OllamaChatSettings } from '../provider';
import { convertToOllamaChatMessages } from '../utils/convert-to-ollama-messages';
import { mapOllamaFinishReason } from '../utils/map-ollama-finish-reason';
import { OllamaError } from '../utils/ollama-error';
import {
  createToolDefinitionMap,
  executeReliableToolCalls,
  extractToolResultsFromPrompt,
  extractToolResultsFromMessages,
  forceCompletion,
  parseToolArguments,
  resolveToolCallingOptions,
  type ToolDefinition,
  type ResolvedToolCallingOptions,
  type ReliableToolCallResult,
} from '../utils/tool-calling-reliability';
import {
  attemptSchemaRecovery,
  generateFallbackValues,
  resolveObjectGenerationOptions,
  type ObjectGenerationOptions,
} from '../utils/object-generation-reliability';

type GenerateResult = {
  content: LanguageModelV2Content[];
  finishReason: LanguageModelV2FinishReason;
  usage: LanguageModelV2Usage;
  providerMetadata?: Record<string, Record<string, JSONValue>>;
  request?: { body: string };
  response?: { id?: string; timestamp?: Date; modelId?: string };
  warnings: LanguageModelV2CallWarning[];
};

interface ParsedToolCall {
  toolName: string;
  input: Record<string, unknown>;
  rawInput: unknown;
}

function parseOllamaToolCalls(
  toolCalls: ChatResponse['message']['tool_calls'] | undefined,
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

function buildContent(
  reasoning: string | undefined,
  includeReasoning: boolean,
  text: string | undefined,
  toolCalls: ParsedToolCall[],
): LanguageModelV2Content[] {
  const content: LanguageModelV2Content[] = [];

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

function aggregateUsage(...responses: ChatResponse[]): LanguageModelV2Usage {
  let inputTokens = 0;
  let outputTokens = 0;

  for (const response of responses) {
    inputTokens += response?.prompt_eval_count ?? 0;
    outputTokens += response?.eval_count ?? 0;
  }

  return {
    inputTokens,
    outputTokens,
    totalTokens: inputTokens + outputTokens,
  };
}

function getLatestUserMessage(messages: OllamaMessage[]): string {
  for (let index = messages.length - 1; index >= 0; index--) {
    const message = messages[index];
    if (
      message &&
      message.role === 'user' &&
      typeof message.content === 'string'
    ) {
      return message.content;
    }
  }

  return '';
}

function getLatestUserPromptText(
  prompt: LanguageModelV2Prompt | undefined,
): string {
  if (!prompt) {
    return '';
  }

  for (let index = prompt.length - 1; index >= 0; index--) {
    const message = prompt[index];

    if (!message || message.role !== 'user') {
      continue;
    }

    // Handle both string and array content types
    if (typeof message.content === 'string') {
      return message.content;
    } else if (Array.isArray(message.content)) {
      const textParts = message.content.filter(
        (part): part is LanguageModelV2TextPart => part.type === 'text',
      );

      if (textParts.length > 0) {
        return textParts.map((part) => part.text).join('\n');
      }
    }
  }

  return '';
}

export interface OllamaChatConfig {
  client: Ollama;
  provider: string;
}

export class OllamaChatLanguageModel implements LanguageModelV2 {
  readonly specificationVersion = 'v2' as const;
  readonly defaultObjectGenerationMode = 'json';
  readonly supportsImages = true; // ✅ Ollama supports images (URLs, files, base64)
  readonly supportsVideoURLs = false; // ❌ Not supported by Ollama API
  readonly supportsAudioURLs = false; // ❌ Not supported by Ollama API
  readonly supportsVideoFile = false; // ❌ Not supported by Ollama API
  readonly supportsAudioFile = false; // ❌ Not supported by Ollama API
  readonly supportsImageFile = true; // ✅ Already correct
  readonly supportedUrls: Record<string, RegExp[]> = {
    // Support common image URL patterns
    image: [
      /^https?:\/\/.*\.(jpg|jpeg|png|gif|webp|bmp|svg)(\?.*)?$/i,
      /^data:image\/[^;]+;base64,/i, // Data URLs
    ],
  };

  constructor(
    public readonly modelId: string,
    public readonly settings: OllamaChatSettings,
    private readonly config: OllamaChatConfig,
  ) {}

  get provider(): string {
    return this.config.provider;
  }

  get supportsStructuredOutputs(): boolean {
    // Auto-detect structured outputs when JSON schema is provided
    // This allows generateObject and streamObject to work without explicit structuredOutputs: true
    return this.settings.structuredOutputs ?? false;
  }

  /**
   * Check if structured outputs should be enabled based on the call options
   * This is used internally to auto-detect when structured outputs are needed
   */
  private shouldEnableStructuredOutputs(
    options: LanguageModelV2CallOptions,
  ): boolean {
    // Auto-detect: if we have a JSON schema, we need structured outputs
    // This overrides explicit settings to ensure object generation works
    if (
      options.responseFormat?.type === 'json' &&
      options.responseFormat.schema
    ) {
      // Warn if structuredOutputs was explicitly set to false but we're auto-enabling it
      if (this.settings.structuredOutputs === false) {
        console.warn(
          'Ollama: structuredOutputs was set to false but auto-enabled for object generation. ' +
            'This ensures generateObject and streamObject work correctly.',
        );
      }
      return true;
    }

    // If explicitly set, use that value (for text generation)
    if (this.settings.structuredOutputs !== undefined) {
      return this.settings.structuredOutputs;
    }

    // Default to false for regular text generation
    return false;
  }

  private getCallOptions(options: LanguageModelV2CallOptions): {
    messages: OllamaMessage[];
    options: Record<string, unknown>;
    format?: string | Record<string, unknown>;
    tools?: Tool[];
    warnings: LanguageModelV2CallWarning[];
  } {
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

    const warnings: LanguageModelV2CallWarning[] = [];

    // Auto-detect structured outputs when JSON schema is provided
    const needsStructuredOutputs = this.shouldEnableStructuredOutputs(options);

    // Check for unsupported features and throw errors
    if (
      responseFormat?.type === 'json' &&
      responseFormat.schema &&
      !needsStructuredOutputs
    ) {
      throw new Error(
        'JSON schema is only supported when structuredOutputs is enabled',
      );
    }

    // Convert AI SDK tools to Ollama format (error already thrown if unsupported)
    const ollamaTools: Tool[] | undefined = tools
      ? tools.map((tool): Tool => {
          if (tool.type === 'function') {
            // The inputSchema from AI SDK should already be a JSON schema
            // when tools are passed to providers
            let jsonSchema: Record<string, unknown>;

            // Check if we have a Zod schema (has parse method) or a JSON schema
            if (tool.inputSchema && typeof tool.inputSchema === 'object') {
              if (
                'parse' in tool.inputSchema &&
                typeof tool.inputSchema.parse === 'function'
              ) {
                // It's a Zod schema - we need to convert it
                // For now, we'll use a basic fallback since zod-to-json-schema has version issues
                console.warn(
                  `Tool ${tool.name} is using a Zod schema directly. Schema conversion may not work properly due to Zod version mismatch.`,
                );
                jsonSchema = {
                  type: 'object',
                  properties: {},
                  additionalProperties: false,
                };
              } else if (
                'properties' in tool.inputSchema ||
                'type' in tool.inputSchema
              ) {
                // It looks like a JSON schema already
                jsonSchema = tool.inputSchema as Record<string, unknown>;
              } else {
                // Unknown schema format
                jsonSchema = {
                  type: 'object',
                  properties: {},
                  additionalProperties: false,
                };
              }
            } else {
              // No schema provided
              jsonSchema = {
                type: 'object',
                properties: {},
                additionalProperties: false,
              };
            }

            return {
              type: 'function',
              function: {
                name: tool.name,
                description: tool.description,
                parameters: jsonSchema,
              },
            };
          }
          // Provider-defined tools not supported by Ollama
          throw new Error(
            `Provider-defined tools are not supported by Ollama. Use function tools instead.`,
          );
        })
      : undefined;

    // Build options with correct precedence:
    // 1. AI SDK call parameters (mapped to Ollama equivalents)
    // 2. Model settings (Ollama options) override AI SDK parameters when both are specified
    const ollamaOptions: Record<string, unknown> = {
      // Start with AI SDK parameters mapped to Ollama names
      ...(temperature !== undefined && { temperature }),
      ...(maxOutputTokens !== undefined && { num_predict: maxOutputTokens }),
      ...(topP !== undefined && { top_p: topP }),
      ...(topK !== undefined && { top_k: topK }),
      ...(frequencyPenalty !== undefined && {
        frequency_penalty: frequencyPenalty,
      }),
      ...(presencePenalty !== undefined && {
        presence_penalty: presencePenalty,
      }),
      ...(stopSequences !== undefined && { stop: stopSequences }),
      ...(seed !== undefined && { seed }),
      // Ollama model options override AI SDK parameters
      ...this.settings.options,
    };

    // Remove undefined values
    for (const key of Object.keys(ollamaOptions)) {
      if (ollamaOptions[key] === undefined) {
        delete ollamaOptions[key];
      }
    }

    let format: string | Record<string, unknown> | undefined;
    if (responseFormat?.type === 'json') {
      if (responseFormat.schema && needsStructuredOutputs) {
        // Remove $schema property and clean complex patterns for Ollama compatibility
        const schema = responseFormat.schema as Record<string, unknown>;
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { $schema, ...cleanedSchema } = schema;

        // Clean complex regex patterns that Ollama can't handle
        format = this.cleanSchemaForOllama(cleanedSchema);
      } else {
        format = 'json';
      }
    }

    const messages = convertToOllamaChatMessages(prompt);

    return {
      messages,
      options: ollamaOptions,
      format,
      tools: ollamaTools,
      warnings,
    };
  }

  /**
   * Clean JSON schema for Ollama compatibility by removing complex patterns
   * that cause "fetch failed" errors while preserving basic validation constraints
   */
  private cleanSchemaForOllama(
    schema: Record<string, unknown>,
  ): Record<string, unknown> {
    if (typeof schema !== 'object' || schema === null) {
      return schema;
    }

    const cleaned = { ...schema };

    // Clean properties recursively
    if (cleaned.properties && typeof cleaned.properties === 'object') {
      const cleanedProperties: Record<string, unknown> = {};

      for (const [key, prop] of Object.entries(
        cleaned.properties as Record<string, unknown>,
      )) {
        if (typeof prop === 'object' && prop !== null) {
          const cleanedProp = { ...(prop as Record<string, unknown>) };

          // Remove complex regex patterns that Ollama can't handle
          // Keep format but remove pattern for email validation
          if (cleanedProp.format === 'email' && cleanedProp.pattern) {
            delete cleanedProp.pattern;
          }

          // Remove other complex patterns that might cause issues
          if (
            typeof cleanedProp.pattern === 'string' &&
            cleanedProp.pattern.length > 50
          ) {
            delete cleanedProp.pattern;
          }

          // Recursively clean nested objects
          cleanedProperties[key] = this.cleanSchemaForOllama(cleanedProp);
        } else {
          cleanedProperties[key] = prop;
        }
      }

      cleaned.properties = cleanedProperties;
    }

    // Clean other schema properties recursively
    for (const [key, value] of Object.entries(cleaned)) {
      if (
        key !== 'properties' &&
        typeof value === 'object' &&
        value !== null &&
        !Array.isArray(value)
      ) {
        cleaned[key] = this.cleanSchemaForOllama(
          value as Record<string, unknown>,
        );
      }
    }

    return cleaned;
  }

  async doGenerate(
    options: LanguageModelV2CallOptions,
  ): Promise<GenerateResult> {
    const {
      messages,
      options: ollamaOptions,
      format,
      tools,
      warnings,
    } = this.getCallOptions(options);

    const functionTools = (options.tools ?? []).filter(
      (tool): tool is LanguageModelV2FunctionTool => tool.type === 'function',
    );

    // Use reliability features for tool calling when enabled
    // The AI SDK handles the tool calling loop, but we can enhance it with force completion
    const reliabilityEnabled =
      functionTools.length > 0 && (this.settings.reliableToolCalling ?? true);

    if (reliabilityEnabled) {
      try {
        const reliabilityOptions = resolveToolCallingOptions(
          this.settings.toolCallingOptions,
        );
        const toolDefinitions = createToolDefinitionMap(functionTools);

        return await this.callWithReliableToolHandling({
          messages,
          ollamaOptions,
          format,
          ollamaTools: tools,
          warnings,
          originalOptions: options,
          toolDefinitions,
          reliabilityOptions,
        });
      } catch (error) {
        if (this.settings.reliableToolCalling === true) {
          console.warn(
            'Reliable tool calling skipped:',
            error instanceof Error ? error.message : error,
          );
        }
      }
    }

    // Check for reliable object generation
    const isObjectGeneration =
      options.responseFormat?.type === 'json' &&
      'schema' in options.responseFormat &&
      options.responseFormat.schema;
    const objectReliabilityEnabled =
      isObjectGeneration && (this.settings.reliableObjectGeneration ?? true);

    if (
      objectReliabilityEnabled &&
      options.responseFormat?.type === 'json' &&
      'schema' in options.responseFormat &&
      options.responseFormat.schema
    ) {
      try {
        const objectOptions = resolveObjectGenerationOptions(
          this.settings.objectGenerationOptions,
        );
        return await this.callWithReliableObjectGeneration({
          messages,
          ollamaOptions,
          format,
          tools,
          warnings,
          originalOptions: options,
          schema: options.responseFormat.schema,
          objectOptions,
        });
      } catch (error) {
        if (this.settings.reliableObjectGeneration === true) {
          console.warn(
            'Reliable object generation skipped:',
            error instanceof Error ? error.message : error,
          );
        }
      }
    }

    // Regular tool calling (original implementation)
    try {
      const response = (await this.config.client.chat({
        model: this.modelId,
        messages,
        options: ollamaOptions,
        format,
        tools,
        stream: false,
      })) as ChatResponse;

      const text = response.message.content;
      const parsedToolCalls = parseOllamaToolCalls(response.message.tool_calls);
      const thinking = response.message.thinking;

      // Convert content based on whether we have tool calls, reasoning, or text
      const content: LanguageModelV2Content[] = [];

      // Add reasoning content if present and enabled
      if (thinking && this.settings.reasoning) {
        content.push({ type: 'reasoning', text: thinking });
      }

      // Add text content if present
      if (text) {
        content.push({ type: 'text', text });
      }

      // Add tool calls if present
      if (parsedToolCalls.length > 0) {
        for (const toolCall of parsedToolCalls) {
          content.push({
            type: 'tool-call',
            toolCallId: crypto.randomUUID(), // Ollama doesn't provide IDs
            toolName: toolCall.toolName,
            input: JSON.stringify(toolCall.input ?? {}),
          });
        }
      }

      return {
        content,
        finishReason: mapOllamaFinishReason(
          response.done_reason,
        ) as LanguageModelV2FinishReason,
        usage: {
          inputTokens: response.prompt_eval_count || 0,
          outputTokens: response.eval_count || 0,
          totalTokens:
            (response.prompt_eval_count || 0) + (response.eval_count || 0),
        },
        providerMetadata: {
          ollama: {
            model: response.model,
            created_at: response.created_at
              ? new Date(response.created_at).toISOString()
              : undefined,
            total_duration: response.total_duration,
            load_duration: response.load_duration,
            eval_duration: response.eval_duration,
            reliable_tool_calling: false,
          } as Record<string, JSONValue>,
        },
        request: {
          body: JSON.stringify({
            model: this.modelId,
            messages,
            options: ollamaOptions,
            format,
            tools,
          }),
        },
        response: {
          timestamp: new Date(),
          modelId: this.modelId,
        },
        warnings,
      };
    } catch (error) {
      throw new OllamaError({
        message: error instanceof Error ? error.message : String(error),
        cause: error,
      });
    }
  }

  private async performForceCompletion(params: {
    messages: OllamaMessage[];
    ollamaOptions: Record<string, unknown>;
    toolResults: Awaited<ReturnType<typeof executeReliableToolCalls>>;
    originalOptions: LanguageModelV2CallOptions;
    format?: string | Record<string, unknown>;
  }): Promise<{ text: string; response: ChatResponse } | undefined> {
    const { messages, ollamaOptions, toolResults, originalOptions, format } =
      params;

    let followUpResponse: ChatResponse | undefined;

    const followUpModel = {
      doGenerate: async (callOptions: LanguageModelV2CallOptions) => {
        const prompt = callOptions.prompt;
        const followUpPrompt =
          typeof prompt === 'string' ? prompt : JSON.stringify(prompt);

        const followUpMessages = [
          ...messages,
          {
            role: 'user',
            content: followUpPrompt,
          },
        ];

        followUpResponse = (await this.config.client.chat({
          model: this.modelId,
          messages: followUpMessages,
          options: ollamaOptions,
          format,
          stream: false,
        })) as ChatResponse;

        const followUpText = followUpResponse.message.content ?? '';

        return {
          content: followUpText
            ? [
                {
                  type: 'text',
                  text: followUpText,
                } satisfies LanguageModelV2Content,
              ]
            : [],
        };
      },
    };

    const originalQuestion =
      getLatestUserPromptText(originalOptions.prompt) ||
      getLatestUserMessage(messages) ||
      'the original user question';

    const completionText = await forceCompletion(
      followUpModel,
      originalQuestion,
      toolResults.map((result) => ({
        toolName: result.toolName,
        result: result.result,
      })) as Array<{ toolName: string; result: unknown }>,
      {
        responseFormat: originalOptions.responseFormat,
      },
    );

    if (!followUpResponse) {
      return undefined;
    }

    return {
      text: completionText,
      response: followUpResponse,
    };
  }

  private buildGenerationResult(params: {
    messages: OllamaMessage[];
    ollamaOptions: Record<string, unknown>;
    format?: string | Record<string, unknown>;
    ollamaTools?: Tool[];
    warnings: LanguageModelV2CallWarning[];
    response: ChatResponse;
    followUpResponse?: ChatResponse;
    parsedToolCalls: ParsedToolCall[];
    completionMethod: ReliableToolCallResult['completionMethod'];
    retryCount: number;
    errors: string[];
    toolResults?: Awaited<ReturnType<typeof executeReliableToolCalls>>;
    reliable: boolean;
    finalTextOverride?: string;
  }): GenerateResult {
    const {
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
    } = params;

    const finalText = finalTextOverride ?? response.message.content ?? '';
    const thinking = response.message.thinking;

    const content = buildContent(
      thinking,
      Boolean(this.settings.reasoning),
      finalText,
      parsedToolCalls,
    );

    const finishSource = followUpResponse ?? response;

    const usage = followUpResponse
      ? aggregateUsage(response, followUpResponse)
      : aggregateUsage(response);

    const finishReason =
      (mapOllamaFinishReason(
        finishSource.done_reason,
      ) as LanguageModelV2FinishReason) ?? 'stop';

    const providerDetails: Record<string, JSONValue> = {};

    providerDetails.model = finishSource.model;
    if (finishSource.created_at) {
      providerDetails.created_at = new Date(
        finishSource.created_at,
      ).toISOString();
    }
    if (finishSource.total_duration !== undefined) {
      providerDetails.total_duration = finishSource.total_duration;
    }
    if (finishSource.load_duration !== undefined) {
      providerDetails.load_duration = finishSource.load_duration;
    }
    if (finishSource.eval_duration !== undefined) {
      providerDetails.eval_duration = finishSource.eval_duration;
    }

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
          return toolResult;
        }) as unknown as JSONValue;
      }
    }

    const requestPayload: Record<string, unknown> = {
      model: this.modelId,
      messages,
      options: ollamaOptions,
      format,
      tools: ollamaTools,
    };

    if (reliable) {
      requestPayload.reliable_tool_calling = true;
    }

    return {
      content,
      finishReason,
      usage,
      providerMetadata: {
        ollama: providerDetails,
      },
      request: {
        body: JSON.stringify(requestPayload),
      },
      response: {
        timestamp: new Date(),
        modelId: this.modelId,
      },
      warnings,
    };
  }

  private async callWithReliableToolHandling(params: {
    messages: OllamaMessage[];
    ollamaOptions: Record<string, unknown>;
    format?: string | Record<string, unknown>;
    ollamaTools?: Tool[];
    warnings: LanguageModelV2CallWarning[];
    originalOptions: LanguageModelV2CallOptions;
    toolDefinitions: Record<string, ToolDefinition>;
    reliabilityOptions: ResolvedToolCallingOptions;
  }): Promise<GenerateResult> {
    const {
      messages,
      ollamaOptions,
      format,
      ollamaTools,
      warnings,
      originalOptions,
      toolDefinitions,
      reliabilityOptions,
    } = params;

    const errors: string[] = [];
    let lastResponse: ChatResponse | undefined;

    for (
      let attempt = 1;
      attempt <= (reliabilityOptions.maxRetries ?? 3);
      attempt++
    ) {
      const response = (await this.config.client.chat({
        model: this.modelId,
        messages,
        options: ollamaOptions,
        format,
        tools: ollamaTools,
        stream: false,
      })) as ChatResponse;

      lastResponse = response;

      const parsedToolCalls = parseOllamaToolCalls(response.message.tool_calls);
      const text = response.message.content ?? '';
      const hasText = text.trim().length > 0;

      if (hasText) {
        return this.buildGenerationResult({
          messages,
          ollamaOptions,
          format,
          ollamaTools,
          warnings,
          response,
          parsedToolCalls,
          completionMethod: 'natural',
          retryCount: attempt,
          errors,
          reliable: true,
        });
      }

      // Extract tool results from the conversation history (AI SDK handles tool execution)
      const promptToolResults = extractToolResultsFromPrompt(
        originalOptions.prompt,
      );

      // Also extract tool results from the messages array (where AI SDK puts them)
      const messageToolResults = extractToolResultsFromMessages(messages);

      if (reliabilityOptions.forceCompletion) {
        try {
          // Combine tool results from both sources
          const allToolResults = [...promptToolResults, ...messageToolResults];

          let toolResults = allToolResults.map((result) => ({
            toolName: result.toolName,
            input: {} as Record<string, unknown>,
            result: result.result,
            success: true,
            toolCallId: result.toolCallId,
          }));

          // If we still don't have tool results, try to execute them manually
          if (
            toolResults.length === 0 &&
            parsedToolCalls.length > 0 &&
            Object.keys(toolDefinitions).length > 0
          ) {
            const executedResults = await executeReliableToolCalls(
              parsedToolCalls.map(({ toolName, input }) => ({
                toolName,
                input,
              })),
              toolDefinitions,
              reliabilityOptions,
            );
            toolResults = executedResults.map((result) => ({
              ...result,
              toolCallId: undefined,
            }));
          }

          if (toolResults.length === 0) {
            errors.push(
              `Attempt ${attempt}: unable to synthesize final response without tool results`,
            );
            continue;
          }

          const followUpData = await this.performForceCompletion({
            messages,
            ollamaOptions,
            toolResults,
            originalOptions,
            format:
              originalOptions.responseFormat?.type === 'json'
                ? format
                : undefined,
          });

          if (followUpData && followUpData.text.trim().length > 0) {
            return this.buildGenerationResult({
              messages,
              ollamaOptions,
              format,
              ollamaTools,
              warnings,
              response,
              followUpResponse: followUpData.response,
              parsedToolCalls,
              completionMethod: 'forced',
              retryCount: attempt,
              errors,
              toolResults,
              reliable: true,
              finalTextOverride: followUpData.text,
            });
          }

          errors.push(
            `Attempt ${attempt}: forced completion returned no final response`,
          );
        } catch (error) {
          errors.push(
            `Attempt ${attempt}: ${
              error instanceof Error ? error.message : String(error)
            }`,
          );
        }
      } else {
        errors.push(
          `Attempt ${attempt}: model returned no final text${
            parsedToolCalls.length > 0 ? ' after executing tools' : ''
          }`,
        );
      }
    }

    if (lastResponse) {
      const parsedToolCalls = parseOllamaToolCalls(
        lastResponse.message.tool_calls,
      );
      return this.buildGenerationResult({
        messages,
        ollamaOptions,
        format,
        ollamaTools,
        warnings,
        response: lastResponse,
        parsedToolCalls,
        completionMethod: 'incomplete',
        retryCount: reliabilityOptions.maxRetries ?? 3,
        errors,
        reliable: true,
      });
    }

    throw new Error(
      'Reliable tool calling failed without producing a response',
    );
  }

  private async callWithReliableObjectGeneration(params: {
    messages: OllamaMessage[];
    ollamaOptions: Record<string, unknown>;
    format?: string | Record<string, unknown>;
    tools?: Tool[];
    warnings: LanguageModelV2CallWarning[];
    originalOptions: LanguageModelV2CallOptions;
    schema: JSONSchema7;
    objectOptions: ObjectGenerationOptions &
      Required<
        Pick<
          ObjectGenerationOptions,
          | 'maxRetries'
          | 'attemptRecovery'
          | 'useFallbacks'
          | 'fixTypeMismatches'
          | 'enableTextRepair'
        >
      >;
  }): Promise<GenerateResult> {
    const {
      messages,
      ollamaOptions,
      format,
      tools,
      warnings,
      schema,
      objectOptions,
    } = params;

    const errors: string[] = [];
    let lastResponse: ChatResponse | undefined;

    for (let attempt = 1; attempt <= objectOptions.maxRetries; attempt++) {
      try {
        const response = (await this.config.client.chat({
          model: this.modelId,
          messages,
          options: ollamaOptions,
          format,
          tools,
          stream: false,
        })) as ChatResponse;

        lastResponse = response;
        const text = response.message.content ?? '';

        if (text.trim().length === 0) {
          errors.push(`Attempt ${attempt}: empty response from model`);
          continue;
        }

        // Try to validate the JSON against the schema
        try {
          const recovery = await attemptSchemaRecovery(
            text,
            schema,
            objectOptions,
          );

          if (recovery.success && recovery.object) {
            // Successfully validated!
            const recoveryMethod = recovery.repaired
              ? 'text_repair'
              : attempt > 1
                ? 'retry'
                : 'natural';
            return this.buildObjectGenerationResult({
              messages,
              ollamaOptions,
              format,
              tools,
              warnings,
              response,
              text,
              validatedObject: recovery.object,
              recoveryMethod,
              retryCount: attempt,
              errors: errors.length > 0 ? errors : undefined,
            });
          } else {
            errors.push(
              `Attempt ${attempt}: schema validation failed - ${recovery.error}`,
            );
          }
        } catch (validationError) {
          errors.push(
            `Attempt ${attempt}: validation error - ${validationError instanceof Error ? validationError.message : String(validationError)}`,
          );
        }
      } catch (error) {
        errors.push(
          `Attempt ${attempt}: generation failed - ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    // If all attempts failed, try fallback values if enabled
    if (objectOptions.useFallbacks) {
      try {
        const fallbackObject = generateFallbackValues(schema);
        const recovery = await attemptSchemaRecovery(
          fallbackObject,
          schema,
          objectOptions,
        );

        if (recovery.success && recovery.object && lastResponse) {
          return this.buildObjectGenerationResult({
            messages,
            ollamaOptions,
            format,
            tools,
            warnings,
            response: lastResponse,
            text: JSON.stringify(recovery.object),
            validatedObject: recovery.object,
            recoveryMethod: 'fallback',
            retryCount: objectOptions.maxRetries,
            errors,
          });
        }
      } catch (fallbackError) {
        errors.push(
          `Fallback generation failed: ${fallbackError instanceof Error ? fallbackError.message : String(fallbackError)}`,
        );
      }
    }

    throw new Error(
      `Object generation failed after ${objectOptions.maxRetries} attempts. Errors: ${errors.join(', ')}`,
    );
  }

  private buildObjectGenerationResult(params: {
    messages: OllamaMessage[];
    ollamaOptions: Record<string, unknown>;
    format?: string | Record<string, unknown>;
    tools?: Tool[];
    warnings: LanguageModelV2CallWarning[];
    response: ChatResponse;
    text: string;
    validatedObject: unknown;
    recoveryMethod:
      | 'natural'
      | 'retry'
      | 'fallback'
      | 'type_fix'
      | 'text_repair';
    retryCount: number;
    errors?: string[];
  }): GenerateResult {
    const { response, text, warnings, recoveryMethod, retryCount, errors } =
      params;

    // For object generation, we return the validated text as content
    const content: LanguageModelV2Content[] = [{ type: 'text', text }];

    const usage: LanguageModelV2Usage = {
      inputTokens: response.prompt_eval_count ?? 0,
      outputTokens: response.eval_count ?? 0,
      totalTokens:
        (response.prompt_eval_count ?? 0) + (response.eval_count ?? 0),
    };

    const finishReason =
      (mapOllamaFinishReason(
        response.done_reason,
      ) as LanguageModelV2FinishReason) ?? 'stop';

    const providerDetails: Record<string, JSONValue> = {
      model: response.model,
      reliable_object_generation: true,
      recovery_method: recoveryMethod,
      retry_count: retryCount,
    };

    if (response.created_at) {
      providerDetails.created_at = new Date(response.created_at).toISOString();
    }
    if (response.total_duration !== undefined) {
      providerDetails.total_duration = response.total_duration;
    }
    if (response.load_duration !== undefined) {
      providerDetails.load_duration = response.load_duration;
    }
    if (response.eval_duration !== undefined) {
      providerDetails.eval_duration = response.eval_duration;
    }
    if (errors && errors.length > 0) {
      providerDetails.reliability_errors = errors;
    }

    return {
      content,
      finishReason,
      usage,
      providerMetadata: {
        ollama: providerDetails,
      },
      request: {
        body: JSON.stringify({
          model: this.modelId,
          messages: params.messages,
          options: params.ollamaOptions,
          format: params.format,
          tools: params.tools,
          reliable_object_generation: true,
        }),
      },
      response: {
        timestamp: new Date(),
        modelId: this.modelId,
      },
      warnings,
    };
  }

  async doStream(options: LanguageModelV2CallOptions): Promise<{
    stream: ReadableStream<LanguageModelV2StreamPart>;
    rawCall: {
      rawPrompt: unknown;
      rawSettings: Record<string, unknown>;
    };
    warnings?: LanguageModelV2CallWarning[];
  }> {
    const {
      messages,
      options: ollamaOptions,
      format,
      tools,
      warnings,
    } = this.getCallOptions(options);

    // Check if tools are being used with streaming
    const functionTools = (options.tools ?? []).filter(
      (tool): tool is LanguageModelV2FunctionTool => tool.type === 'function',
    );

    const hasTools = functionTools.length > 0;
    const reliabilityEnabled =
      hasTools && (this.settings.reliableToolCalling ?? true);

    if (hasTools && reliabilityEnabled) {
      // Note: Full tool calling reliability is handled by the AI SDK's streaming loop
      // We can only enhance the individual stream responses here
      console.log(
        `🔧 Streaming with ${functionTools.length} tools (AI SDK handles tool calling loop)`,
      );
    }

    try {
      const stream = await this.config.client.chat({
        model: this.modelId,
        messages,
        options: ollamaOptions,
        format,
        tools,
        stream: true,
      });

      let usage: LanguageModelV2Usage = {
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
      };
      let finishReason: LanguageModelV2FinishReason = 'unknown';

      // Capture settings for use in transform function
      const reasoningEnabled = this.settings.reasoning;

      const transformStream = new TransformStream<
        ChatResponse,
        LanguageModelV2StreamPart
      >({
        async transform(chunk: ChatResponse, controller) {
          // Validate chunk
          if (!chunk || typeof chunk !== 'object') {
            return; // Skip invalid chunks
          }

          // Regular chunk with content
          if (chunk.done) {
            // If the final chunk carries residual content, emit it before finish
            if (
              chunk.message &&
              typeof chunk.message.content === 'string' &&
              chunk.message.content.length > 0
            ) {
              controller.enqueue({
                type: 'text-delta',
                id: crypto.randomUUID(),
                delta: chunk.message.content,
              });
            }

            // Final chunk with metadata
            usage = {
              inputTokens: chunk.prompt_eval_count || 0,
              outputTokens: chunk.eval_count || 0,
              totalTokens:
                (chunk.prompt_eval_count || 0) + (chunk.eval_count || 0),
            };
            finishReason = mapOllamaFinishReason(
              chunk.done_reason,
            ) as LanguageModelV2FinishReason;

            controller.enqueue({
              type: 'finish',
              finishReason,
              usage,
            });
          } else {
            // Handle reasoning in streaming
            if (chunk.message.thinking && reasoningEnabled) {
              // For reasoning, we'll emit it as a single reasoning content
              // since Ollama doesn't stream reasoning in chunks
              controller.enqueue({
                type: 'reasoning-start',
                id: crypto.randomUUID(),
              });

              controller.enqueue({
                type: 'reasoning-delta',
                id: crypto.randomUUID(),
                delta: chunk.message.thinking,
              });

              controller.enqueue({
                type: 'reasoning-end',
                id: crypto.randomUUID(),
              });
            }

            // Handle tool calls in streaming
            if (
              chunk.message.tool_calls &&
              chunk.message.tool_calls.length > 0
            ) {
              for (const toolCall of chunk.message.tool_calls) {
                const toolInput = toolCall.function.arguments || {};

                controller.enqueue({
                  type: 'tool-call',
                  toolCallId: crypto.randomUUID(), // Ollama doesn't provide IDs
                  toolName: toolCall.function.name,
                  input: JSON.stringify(toolInput),
                });
              }
            }

            // Handle text content in streaming (always emit if present)
            if (
              chunk.message.content &&
              typeof chunk.message.content === 'string' &&
              chunk.message.content.length > 0
            ) {
              controller.enqueue({
                type: 'text-delta',
                id: crypto.randomUUID(), // Generate unique ID for each text chunk
                delta: chunk.message.content,
              });
            }
          }
        },
      });

      // Create a readable stream from the async generator
      const readableStream = new ReadableStream({
        async start(controller) {
          try {
            for await (const chunk of stream) {
              // Ensure chunk is valid before enqueuing
              if (chunk && typeof chunk === 'object') {
                controller.enqueue(chunk);
              }
            }
            controller.close();
          } catch (error) {
            controller.error(error);
          }
        },
      });

      return {
        stream: readableStream.pipeThrough(transformStream),
        rawCall: {
          rawPrompt: messages,
          rawSettings: {
            model: this.modelId,
            options: ollamaOptions,
            format,
            tools,
          },
        },
        warnings: warnings.length > 0 ? warnings : undefined,
      };
    } catch (error) {
      throw new OllamaError({
        message: error instanceof Error ? error.message : String(error),
        cause: error,
      });
    }
  }
}
