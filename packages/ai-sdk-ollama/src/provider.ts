import {
  LanguageModelV2,
  EmbeddingModelV2,
  ProviderV2,
  NoSuchModelError,
} from '@ai-sdk/provider';
import { Ollama, type Options as OllamaOptions } from 'ollama';
import { OllamaChatLanguageModel } from './models/chat-language-model';
import { OllamaEmbeddingModel } from './models/embedding-model';

// Extend Ollama Options to include missing parameters
export interface Options extends OllamaOptions {
  /**
   * Minimum probability threshold for token selection
   * This parameter is supported by Ollama API but missing from ollama-js TypeScript definitions
   */
  min_p?: number;
}

// Re-export ollama-js types for convenience
export type { Ollama } from 'ollama';

export interface OllamaProviderSettings {
  /**
   * Base URL for the Ollama API (defaults to http://127.0.0.1:11434)
   */
  baseURL?: string;

  /**
   * Custom headers for API requests
   */
  headers?: Record<string, string>;

  /**
   * Custom fetch implementation
   */
  fetch?: typeof fetch;

  /**
   * Existing Ollama client instance to use instead of creating a new one
   */
  client?: Ollama;
}

export interface OllamaProvider extends ProviderV2 {
  /**
   * Create a language model instance
   */
  (modelId: string, settings?: OllamaChatSettings): LanguageModelV2;

  /**
   * Create a language model instance with the `chat` method
   */
  chat(modelId: string, settings?: OllamaChatSettings): LanguageModelV2;

  /**
   * Create a language model instance with the `languageModel` method
   */
  languageModel(
    modelId: string,
    settings?: OllamaChatSettings,
  ): LanguageModelV2;

  /**
   * Create an embedding model instance
   */
  embedding(
    modelId: string,
    settings?: OllamaEmbeddingSettings,
  ): EmbeddingModelV2<string>;

  /**
   * Create an embedding model instance with the `textEmbedding` method
   */
  textEmbedding(
    modelId: string,
    settings?: OllamaEmbeddingSettings,
  ): EmbeddingModelV2<string>;

  /**
   * Create an embedding model instance with the `textEmbeddingModel` method
   */
  textEmbeddingModel(
    modelId: string,
    settings?: OllamaEmbeddingSettings,
  ): EmbeddingModelV2<string>;
}

export interface OllamaChatSettings {
  /**
   * Enable structured output mode
   */
  structuredOutputs?: boolean;

  /**
   * Enable reasoning support for models that support it
   */
  reasoning?: boolean;

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
   * fixTypeMismatches=true).
   */
  objectGenerationOptions?: {
    /**
     * Maximum number of retry attempts for object generation
     */
    maxRetries?: number;

    /**
     * Whether to attempt schema recovery when validation fails
     */
    attemptRecovery?: boolean;

    /**
     * Whether to use fallback values for failed generations
     */
    useFallbacks?: boolean;

    /**
     * Custom fallback values for specific fields
     */
    fallbackValues?: Record<string, unknown>;

    /**
     * Timeout for object generation in milliseconds
     */
    generationTimeout?: number;

    /**
     * Whether to validate and fix type mismatches
     */
    fixTypeMismatches?: boolean;
  };

  /**
   * Additional model parameters - re-exported from ollama-js
   * This automatically includes ALL Ollama parameters including new ones like 'dimensions'
   */
  options?: Partial<Options>;
}

export interface OllamaEmbeddingSettings {
  /**
   * Additional embedding parameters
   */
  options?: Partial<Options>;

  /**
   * Dimensions for embedding output (if supported by the model)
   * This is a direct parameter of EmbedRequest, not part of Options
   */
  dimensions?: number;
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
 * Create an Ollama provider instance
 */
export function createOllama(
  options: OllamaProviderSettings = {},
): OllamaProvider {
  // Use existing client or create new one
  const client =
    options.client ||
    new Ollama({
      host: options.baseURL,
      fetch: options.fetch,
      headers: options.headers,
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

  return provider as OllamaProvider;
}

/**
 * Default Ollama provider instance
 */
export const ollama = createOllama();
