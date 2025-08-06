import {
  LanguageModelV2,
  LanguageModelV2CallOptions,
  LanguageModelV2CallWarning,
  LanguageModelV2FinishReason,
  LanguageModelV2StreamPart,
  LanguageModelV2Usage,
  LanguageModelV2Content,
  JSONValue,
} from '@ai-sdk/provider';
import { Ollama, Message as OllamaMessage, ChatResponse, Tool } from 'ollama';
import { OllamaChatSettings } from '../provider';
import { convertToOllamaChatMessages } from '../utils/convert-to-ollama-messages';
import { mapOllamaFinishReason } from '../utils/map-ollama-finish-reason';
import { OllamaError } from '../utils/ollama-error';

export interface OllamaChatConfig {
  client: Ollama;
  provider: string;
}

export class OllamaChatLanguageModel implements LanguageModelV2 {
  readonly specificationVersion = 'v2' as const;
  readonly defaultObjectGenerationMode = 'json';
  readonly supportsImages = false;
  readonly supportsVideoURLs = false;
  readonly supportsAudioURLs = false;
  readonly supportsVideoFile = false;
  readonly supportsAudioFile = false;
  readonly supportsImageFile = true;
  readonly supportedUrls: Record<string, RegExp[]> = {};

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

  private getCallOptions(options: LanguageModelV2CallOptions): {
    messages: OllamaMessage[];
    options: Record<string, unknown>;
    format?: string;
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

    // Check for unsupported features and throw errors
    if (
      responseFormat?.type === 'json' &&
      responseFormat.schema &&
      !this.supportsStructuredOutputs
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

    let format: string | undefined;
    if (responseFormat?.type === 'json') {
      format = 'json';
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

  async doGenerate(options: LanguageModelV2CallOptions): Promise<{
    content: LanguageModelV2Content[];
    finishReason: LanguageModelV2FinishReason;
    usage: LanguageModelV2Usage;
    providerMetadata?: Record<string, Record<string, JSONValue>>;
    request?: { body: string };
    response?: { id?: string; timestamp?: Date; modelId?: string };
    warnings: LanguageModelV2CallWarning[];
  }> {
    const {
      messages,
      options: ollamaOptions,
      format,
      tools,
      warnings,
    } = this.getCallOptions(options);

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
      const toolCalls = response.message.tool_calls;

      // Convert content based on whether we have tool calls
      const content: LanguageModelV2Content[] = [];

      if (text) {
        content.push({ type: 'text', text });
      }

      if (toolCalls && toolCalls.length > 0) {
        for (const toolCall of toolCalls) {
          const toolInput = toolCall.function.arguments || {};

          content.push({
            type: 'tool-call',
            toolCallId: crypto.randomUUID(), // Ollama doesn't provide IDs
            toolName: toolCall.function.name,
            input: JSON.stringify(toolInput),
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
            } else if (
              chunk.message.content &&
              typeof chunk.message.content === 'string'
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
