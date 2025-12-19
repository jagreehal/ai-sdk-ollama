import {
  LanguageModelV3,
  EmbeddingModelV3,
  ProviderV3,
  NoSuchModelError,
} from '@ai-sdk/provider';
import {
  Ollama,
  type Options as OllamaOptions,
  type ChatRequest,
  type EmbedRequest,
  type Config,
} from 'ollama';
import { OllamaChatLanguageModel } from './models/chat-language-model';
import { OllamaEmbeddingModel } from './models/embedding-model';
import { ollamaTools } from './ollama-tools';
import type { WebSearchToolOptions } from './tool/web-search';
import type { WebFetchToolOptions } from './tool/web-fetch';
import type { ObjectGenerationOptions } from './utils/object-generation-reliability';

// Extend Ollama Options to include missing parameters
export interface Options extends OllamaOptions {
  /**
   * Minimum probability threshold for token selection
   * This parameter is supported by Ollama API but missing from ollama-js TypeScript definitions
   */
  min_p?: number;
}

// Re-export ollama-js types for convenience
export type {
  Ollama,
  ChatRequest,
  EmbedRequest,
  Config,
  ToolCall,
  Tool,
  Message,
  ChatResponse,
  EmbedResponse,
} from 'ollama';

/**
 * Settings for configuring the Ollama provider.
 * Extends from Ollama's Config type for consistency with the underlying client.
 */
export interface OllamaProviderSettings extends Pick<Config, 'headers' | 'fetch'> {
  /**
   * Base URL for the Ollama API (defaults to http://127.0.0.1:11434)
   * Maps to Config.host in the Ollama client
   */
  baseURL?: string;

  /**
   * Ollama API key for authentication with cloud services.
   * The API key will be set as Authorization: Bearer {apiKey} header.
   */
  apiKey?: string;

  /**
   * Existing Ollama client instance to use instead of creating a new one.
   * When provided, baseURL, headers, and fetch are ignored.
   */
  client?: Ollama;
}

export interface OllamaProvider extends ProviderV3 {
  /**
   * Create a language model instance
   */
  (modelId: string, settings?: OllamaChatSettings): LanguageModelV3;

  /**
   * Create a language model instance with the `chat` method
   */
  chat(modelId: string, settings?: OllamaChatSettings): LanguageModelV3;

  /**
   * Create a language model instance with the `languageModel` method
   */
  languageModel(
    modelId: string,
    settings?: OllamaChatSettings,
  ): LanguageModelV3;

  /**
   * Create an embedding model instance
   */
  embedding(
    modelId: string,
    settings?: OllamaEmbeddingSettings,
  ): EmbeddingModelV3;

  /**
   * Create an embedding model instance with the `textEmbedding` method
   */
  textEmbedding(
    modelId: string,
    settings?: OllamaEmbeddingSettings,
  ): EmbeddingModelV3;

  /**
   * Create an embedding model instance with the `textEmbeddingModel` method
   */
  textEmbeddingModel(
    modelId: string,
    settings?: OllamaEmbeddingSettings,
  ): EmbeddingModelV3;

  /**
   * Ollama-specific tools that leverage web search capabilities
   */
  tools: {
    webSearch: (
      options?: WebSearchToolOptions,
    ) => ReturnType<typeof ollamaTools.webSearch>;
    webFetch: (
      options?: WebFetchToolOptions,
    ) => ReturnType<typeof ollamaTools.webFetch>;
  };
}

export interface OllamaChatSettings
  extends Pick<ChatRequest, 'keep_alive' | 'format' | 'tools' | 'think'> {
  /**
   * Additional model parameters - uses extended Options type that includes min_p
   * This automatically includes ALL Ollama parameters including new ones like 'dimensions'
   */
  options?: Partial<Options>;

  /**
   * Enable structured output mode
   */
  structuredOutputs?: boolean;

  /**
   * Enable reliable tool calling with retry and completion mechanisms.
   * Defaults to true whenever function tools are provided; set to false to opt out.
   */
  reliableToolCalling?: boolean;

  /**
   * Tool calling reliability options. These override the sensible defaults used by the
   * built-in reliability layer (maxRetries=2, forceCompletion=true,
   * normalizeParameters=true, validateResults=true).
   */
  toolCallingOptions?: {
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
  };

  /**
   * Enable reliable object generation with retry and repair mechanisms.
   * Defaults to true whenever JSON schemas are used; set to false to opt out.
   */
  reliableObjectGeneration?: boolean;

  /**
   * Object generation reliability options. These override the sensible defaults used by the
   * built-in reliability layer (maxRetries=3, attemptRecovery=true, useFallbacks=true,
   * fixTypeMismatches=true, enableTextRepair=true).
   */
  objectGenerationOptions?: ObjectGenerationOptions;
}

/**
 * Settings for configuring Ollama embedding models.
 * Uses Pick from EmbedRequest for type consistency with the Ollama API.
 */
export interface OllamaEmbeddingSettings extends Pick<EmbedRequest, 'dimensions'> {
  /**
   * Additional embedding parameters (temperature, num_ctx, etc.)
   */
  options?: Partial<Options>;
}

/**
 * Options for configuring Ollama provider calls
 */
export interface OllamaProviderOptions {
  /**
   * Additional headers to include in requests
   */
  headers?: Record<string, string>;
}

/**
 * Options for configuring Ollama chat model calls
 */
export interface OllamaChatProviderOptions extends OllamaProviderOptions {
  /**
   * Enable structured output mode for object generation
   */
  structuredOutputs?: boolean;
}

/**
 * Options for configuring Ollama embedding model calls
 */
export interface OllamaEmbeddingProviderOptions extends OllamaProviderOptions {
  /**
   * Maximum number of embeddings to process in a single call
   */
  maxEmbeddingsPerCall?: number;
}

/**
 * Type guard to check if an object is Headers-like (has entries method)
 */
function isHeadersLike(
  obj: unknown,
): obj is { entries: () => IterableIterator<[string, string]> } {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'entries' in obj &&
    typeof (obj as { entries: unknown }).entries === 'function'
  );
}

/**
 * Normalize HeadersInit to a plain object for safe merging
 */
function normalizeHeaders(
  headers: Record<string, string> | Headers | [string, string][] | undefined,
): Record<string, string> {
  if (!headers) {
    return {};
  }

  // If it's an array of [key, value] tuples, convert first
  if (Array.isArray(headers)) {
    const result: Record<string, string> = {};
    for (const [key, value] of headers) {
      result[key] = value;
    }
    return result;
  }

  // If it's a Headers instance (check by method presence, not instanceof for cross-context compatibility)
  if (isHeadersLike(headers)) {
    const result: Record<string, string> = {};
    for (const [key, value] of headers.entries()) {
      result[key] = value;
    }
    return result;
  }

  // If it's already a plain object, return it
  if (typeof headers === 'object') {
    return headers as Record<string, string>;
  }

  return {};
}

/**
 * Create an Ollama provider instance
 */
export function createOllama(
  options: OllamaProviderSettings = {},
): OllamaProvider {
  // Normalize headers to a plain object for safe merging
  const normalizedHeaders = normalizeHeaders(options.headers);

  // Add Authorization header if apiKey is provided and not already set
  if (options.apiKey && !normalizedHeaders.Authorization && !normalizedHeaders.authorization) {
    normalizedHeaders.Authorization = `Bearer ${options.apiKey}`;
  }

  // Use existing client or create new one
  const client =
    options.client ||
    new Ollama({
      host: options.baseURL,
      fetch: options.fetch,
      headers: Object.keys(normalizedHeaders).length > 0 ? normalizedHeaders : undefined,
    });

  const createChatModel = (
    modelId: string,
    settings: OllamaChatSettings = {},
  ) => {
    return new OllamaChatLanguageModel(modelId, settings, {
      client,
      provider: 'ollama',
    });
  };

  const createEmbeddingModel = (
    modelId: string,
    settings: OllamaEmbeddingSettings = {},
  ) => {
    return new OllamaEmbeddingModel(modelId, settings, {
      client,
      provider: 'ollama',
    });
  };

  const provider = function (modelId: string, settings?: OllamaChatSettings) {
    if (new.target) {
      throw new Error(
        'The Ollama provider cannot be called with the new keyword.',
      );
    }
    return createChatModel(modelId, settings);
  };

  provider.chat = createChatModel;
  provider.languageModel = createChatModel;
  provider.embedding = createEmbeddingModel;
  provider.textEmbedding = createEmbeddingModel;
  provider.textEmbeddingModel = createEmbeddingModel;
  provider.imageModel = (modelId: string) => {
    throw new NoSuchModelError({
      modelId,
      modelType: 'imageModel',
      message: 'Image generation is not supported by Ollama',
    });
  };

  // Create tools with the Ollama client injected - following AI SDK pattern
  const toolsWithClient = {
    webSearch: (options = {}) => ollamaTools.webSearch({ ...options, client }),
    webFetch: (options = {}) => ollamaTools.webFetch({ ...options, client }),
  };

  provider.tools = toolsWithClient;

  return provider as unknown as OllamaProvider;
}

/**
 * Default Ollama provider instance
 */
export const ollama = createOllama();
