import {
  LanguageModelV4,
  LanguageModelV4CallOptions,
  LanguageModelV4Content,
  LanguageModelV4FunctionTool,
  LanguageModelV4StreamPart,
  JSONSchema7,
  SharedV4Warning,
} from '@ai-sdk/provider';
import {
  ChatRequest,
  Message as OllamaMessage,
  ChatResponse,
  Tool,
} from 'ollama';
import type { AbortableStream, OllamaClient } from '../ollama-client';
import { OllamaChatSettings } from '../provider';
import { OllamaError } from '../utils/ollama-error';
import {
  createToolDefinitionMap,
  executeReliableToolCalls,
  extractToolResultsFromPrompt,
  extractToolResultsFromMessages,
  forceCompletion,
  resolveToolCallingOptions,
  type ToolDefinition,
  type ResolvedToolCallingOptions,
} from '../utils/tool-calling-reliability';
import {
  attemptSchemaRecovery,
  resolveObjectGenerationOptions,
  type ObjectGenerationOptions,
} from '../utils/object-generation-reliability';
import { generateFallbackValues } from '../utils/json-schema-coercion';
import {
  buildChatRequest,
  getCallOptions,
  getLatestUserMessage,
  getLatestUserPromptText,
  resolveThink,
} from './chat-request';
import {
  buildGenerationResult,
  buildObjectGenerationResult,
  parseOllamaToolCalls,
  type GenerateResult,
} from './chat-result';
import { createChunkTransformer } from './chat-stream';

export interface OllamaChatConfig {
  client: OllamaClient;
  provider: string;
}

/**
 * Cancellation is not a retryable failure: rethrow so the reliability paths
 * neither retry nor fall back on an aborted request. Call with no `error` at
 * the top of a retry attempt, and with the caught error from a catch that
 * would otherwise recover.
 */
function rethrowIfAborted(
  signal: AbortSignal | undefined,
  error?: unknown,
): void {
  if (error instanceof Error && error.name === 'AbortError') {
    throw error;
  }
  signal?.throwIfAborted();
}

export class OllamaChatLanguageModel implements LanguageModelV4 {
  readonly specificationVersion = 'v4' as const;

  // V3 uses supportedUrls with media type patterns as keys
  // Ollama supports images via URLs, files, and base64
  readonly supportedUrls: Record<string, RegExp[]> = {
    'image/*': [
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
    return this.settings.structuredOutputs ?? false;
  }

  private chat(
    request: ChatRequest & { stream: true },
    abortSignal?: AbortSignal,
  ): Promise<AbortableStream<ChatResponse>>;
  private chat(
    request: ChatRequest & { stream?: false },
    abortSignal?: AbortSignal,
  ): Promise<ChatResponse>;
  private chat(
    request: ChatRequest,
    abortSignal?: AbortSignal,
  ): Promise<ChatResponse | AbortableStream<ChatResponse>> {
    const chat = this.config.client.chat.bind(this.config.client) as (
      request: ChatRequest,
      options?: { signal?: AbortSignal },
    ) => Promise<ChatResponse | AbortableStream<ChatResponse>>;

    return abortSignal ? chat(request, { signal: abortSignal }) : chat(request);
  }

  async doGenerate(
    options: LanguageModelV4CallOptions,
  ): Promise<GenerateResult> {
    const {
      messages,
      options: ollamaOptions,
      format,
      tools,
      warnings,
      keep_alive,
    } = getCallOptions(this.settings, options);

    const think = resolveThink(this.settings, options);

    const functionTools = (options.tools ?? []).filter(
      (tool): tool is LanguageModelV4FunctionTool => tool.type === 'function',
    );

    // Use reliability features for tool calling when explicitly enabled
    // By default (false), let the AI SDK handle the multi-turn tool calling flow naturally
    // This ensures compatibility with standard AI SDK patterns
    const reliabilityEnabled =
      functionTools.length > 0 && (this.settings.reliableToolCalling ?? false);

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
          keep_alive,
        });
      } catch (error) {
        rethrowIfAborted(options.abortSignal, error);
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
          keep_alive,
        });
      } catch (error) {
        rethrowIfAborted(options.abortSignal, error);
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
      const response = await this.chat(
        {
          ...buildChatRequest({
            modelId: this.modelId,
            messages,
            options: ollamaOptions,
            format,
            tools,
            keep_alive,
            think,
          }),
          stream: false,
        },
        options.abortSignal,
      );

      return buildGenerationResult({
        modelId: this.modelId,
        messages,
        ollamaOptions,
        format,
        ollamaTools: tools,
        warnings,
        response,
        parsedToolCalls: parseOllamaToolCalls(response.message.tool_calls),
        completionMethod: 'natural',
        retryCount: 0,
        errors: [],
        reliable: false,
        keep_alive,
      });
    } catch (error) {
      throw new OllamaError({
        message: error instanceof Error ? error.message : String(error),
        cause: error,
      });
    }
  }

  private async performForceCompletion(parameters: {
    messages: OllamaMessage[];
    ollamaOptions: Record<string, unknown>;
    toolResults: Awaited<ReturnType<typeof executeReliableToolCalls>>;
    originalOptions: LanguageModelV4CallOptions;
    format?: string | Record<string, unknown>;
    keep_alive?: string | number;
  }): Promise<{ text: string; response: ChatResponse } | undefined> {
    const {
      messages,
      ollamaOptions,
      toolResults,
      originalOptions,
      format,
      keep_alive,
    } = parameters;

    const think = resolveThink(this.settings, originalOptions);

    let followUpResponse: ChatResponse | undefined;

    const followUpModel = {
      doGenerate: async (callOptions: LanguageModelV4CallOptions) => {
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

        followUpResponse = await this.chat(
          {
            ...buildChatRequest({
              modelId: this.modelId,
              messages: followUpMessages,
              options: ollamaOptions,
              format,
              keep_alive,
              think,
            }),
            stream: false,
          },
          callOptions.abortSignal ?? originalOptions.abortSignal,
        );

        const followUpText = followUpResponse.message.content ?? '';

        return {
          content: followUpText
            ? [
                {
                  type: 'text',
                  text: followUpText,
                } satisfies LanguageModelV4Content,
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

  private async callWithReliableToolHandling(parameters: {
    messages: OllamaMessage[];
    ollamaOptions: Record<string, unknown>;
    format?: string | Record<string, unknown>;
    ollamaTools?: Tool[];
    warnings: SharedV4Warning[];
    originalOptions: LanguageModelV4CallOptions;
    toolDefinitions: Record<string, ToolDefinition>;
    reliabilityOptions: ResolvedToolCallingOptions;
    keep_alive?: string | number;
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
      keep_alive,
    } = parameters;

    const think = resolveThink(this.settings, originalOptions);

    const errors: string[] = [];
    let lastResponse: ChatResponse | undefined;

    for (
      let attempt = 1;
      attempt <= (reliabilityOptions.maxRetries ?? 3);
      attempt++
    ) {
      rethrowIfAborted(originalOptions.abortSignal);

      const response = await this.chat(
        {
          ...buildChatRequest({
            modelId: this.modelId,
            messages,
            options: ollamaOptions,
            format,
            tools: ollamaTools,
            keep_alive,
            think,
          }),
          stream: false,
        },
        originalOptions.abortSignal,
      );

      lastResponse = response;

      const parsedToolCalls = parseOllamaToolCalls(response.message.tool_calls);
      const text = response.message.content ?? '';
      const hasText = text.trim().length > 0;

      if (hasText) {
        return buildGenerationResult({
          modelId: this.modelId,
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
          keep_alive,
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
            keep_alive,
          });

          if (followUpData && followUpData.text.trim().length > 0) {
            return buildGenerationResult({
              modelId: this.modelId,
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
              keep_alive,
            });
          }

          errors.push(
            `Attempt ${attempt}: forced completion returned no final response`,
          );
        } catch (error) {
          rethrowIfAborted(originalOptions.abortSignal, error);
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
      return buildGenerationResult({
        modelId: this.modelId,
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
        keep_alive,
      });
    }

    throw new Error(
      'Reliable tool calling failed without producing a response',
    );
  }

  private async callWithReliableObjectGeneration(parameters: {
    messages: OllamaMessage[];
    ollamaOptions: Record<string, unknown>;
    format?: string | Record<string, unknown>;
    tools?: Tool[];
    warnings: SharedV4Warning[];
    originalOptions: LanguageModelV4CallOptions;
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
    keep_alive?: string | number;
  }): Promise<GenerateResult> {
    const {
      messages,
      ollamaOptions,
      format,
      tools,
      warnings,
      originalOptions,
      schema,
      objectOptions,
      keep_alive,
    } = parameters;

    const think = resolveThink(this.settings, originalOptions);

    const errors: string[] = [];
    let lastResponse: ChatResponse | undefined;

    for (let attempt = 1; attempt <= objectOptions.maxRetries; attempt++) {
      rethrowIfAborted(originalOptions.abortSignal);

      try {
        const response = await this.chat(
          {
            ...buildChatRequest({
              modelId: this.modelId,
              messages,
              options: ollamaOptions,
              format,
              tools,
              keep_alive,
              think,
            }),
            stream: false,
          },
          originalOptions.abortSignal,
        );

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
            return buildObjectGenerationResult({
              modelId: this.modelId,
              messages,
              ollamaOptions,
              format,
              tools,
              warnings,
              response,
              text,
              recoveryMethod,
              retryCount: attempt,
              errors: errors.length > 0 ? errors : undefined,
              keep_alive,
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
        rethrowIfAborted(originalOptions.abortSignal, error);
        errors.push(
          `Attempt ${attempt}: generation failed - ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    rethrowIfAborted(originalOptions.abortSignal);

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
          return buildObjectGenerationResult({
            modelId: this.modelId,
            messages,
            ollamaOptions,
            format,
            tools,
            warnings,
            response: lastResponse,
            text: JSON.stringify(recovery.object),
            recoveryMethod: 'fallback',
            retryCount: objectOptions.maxRetries,
            errors,
            keep_alive,
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

  async doStream(options: LanguageModelV4CallOptions): Promise<{
    stream: ReadableStream<LanguageModelV4StreamPart>;
    request?: { body?: unknown };
    response?: { headers?: Record<string, string> };
  }> {
    const {
      messages,
      options: ollamaOptions,
      format,
      tools,
      warnings,
      keep_alive,
    } = getCallOptions(this.settings, options);

    const think = resolveThink(this.settings, options);

    try {
      const stream = await this.chat(
        {
          ...buildChatRequest({
            modelId: this.modelId,
            messages,
            options: ollamaOptions,
            format,
            tools,
            keep_alive,
            think,
          }),
          stream: true,
        },
        options.abortSignal,
      );

      const transformStream = createChunkTransformer({
        warnings,
        includeRawChunks: options.includeRawChunks,
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
        request: {
          body: {
            model: this.modelId,
            messages,
            options: ollamaOptions,
            format,
            tools,
            ...(keep_alive !== undefined && { keep_alive }),
          },
        },
        response: {
          headers: {},
        },
      };
    } catch (error) {
      throw new OllamaError({
        message: error instanceof Error ? error.message : String(error),
        cause: error,
      });
    }
  }
}
