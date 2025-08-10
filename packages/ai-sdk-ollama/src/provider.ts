import {
  LanguageModelV2,
  EmbeddingModelV2,
  ProviderV2,
  NoSuchModelError,
} from '@ai-sdk/provider';
import { Ollama } from 'ollama';
import { OllamaChatLanguageModel } from './models/chat-language-model';
import { OllamaEmbeddingModel } from './models/embedding-model';

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
   * Additional model parameters
   */
  options?: {
    num_ctx?: number;
    num_predict?: number;
    temperature?: number;
    top_k?: number;
    top_p?: number;
    min_p?: number;
    seed?: number;
    stop?: string[];
    num_keep?: number;
    typical_p?: number;
    repeat_last_n?: number;
    repeat_penalty?: number;
    presence_penalty?: number;
    frequency_penalty?: number;
    mirostat?: number;
    mirostat_tau?: number;
    mirostat_eta?: number;
    penalize_newline?: boolean;
    numa?: boolean;
    num_thread?: number;
    num_gpu?: number;
    main_gpu?: number;
    low_vram?: boolean;
    f16_kv?: boolean;
    vocab_only?: boolean;
    use_mmap?: boolean;
    use_mlock?: boolean;
  };
}

export interface OllamaEmbeddingSettings {
  /**
   * Additional embedding parameters
   */
  options?: {
    num_thread?: number;
  };
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
  const client = new Ollama({
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
