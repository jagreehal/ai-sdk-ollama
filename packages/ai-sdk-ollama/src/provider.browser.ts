// Browser-specific provider that uses ollama/browser
import { Ollama as OllamaBrowser } from 'ollama/browser';
import type { Ollama } from 'ollama';
import { OllamaChatLanguageModel } from './models/chat-language-model';
import { OllamaEmbeddingModel } from './models/embedding-model';
import {
  OllamaRerankingModel,
  OllamaRerankingSettings,
} from './models/reranking-model';
import {
  OllamaEmbeddingRerankingModel,
  OllamaEmbeddingRerankingSettings,
} from './models/embedding-reranking-model';
import { OllamaImageModel } from './models/image-model';
import { ollamaTools } from './ollama-tools';

// Re-export all the types
export type {
  OllamaProviderSettings,
  OllamaProvider,
  OllamaChatSettings,
  OllamaEmbeddingSettings,
  OllamaProviderOptions,
  OllamaChatProviderOptions,
  OllamaEmbeddingProviderOptions,
} from './provider';

// Import types only to avoid duplication
import type {
  OllamaProviderSettings,
  OllamaProvider,
  OllamaChatSettings,
  OllamaEmbeddingSettings,
} from './provider';

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
 * Create an Ollama provider instance for browser environments
 */
export function createOllama(
  options: OllamaProviderSettings = {},
): OllamaProvider {
  // Normalize headers to a plain object for safe merging
  const normalizedHeaders = normalizeHeaders(options.headers);

  // Add Authorization header if apiKey is available and not already set
  if (
    options.apiKey &&
    !normalizedHeaders.Authorization &&
    !normalizedHeaders.authorization
  ) {
    normalizedHeaders.Authorization = `Bearer ${options.apiKey}`;
  }

  // Create browser-compatible Ollama client
  // Cast to Ollama type for compatibility with shared model code
  const client = new OllamaBrowser({
    host: options.baseURL,
    fetch: options.fetch,
    headers:
      Object.keys(normalizedHeaders).length > 0 ? normalizedHeaders : undefined,
  }) as Ollama;

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

  const createRerankingModel = (
    modelId: string,
    settings: OllamaRerankingSettings = {},
  ) => {
    // Determine base URL for direct HTTP calls
    const baseURL = options.baseURL ?? 'http://127.0.0.1:11434';

    return new OllamaRerankingModel(modelId, settings, {
      provider: 'ollama.reranking',
      baseURL,
      headers: () => normalizedHeaders,
      fetch: options.fetch,
    });
  };

  const createEmbeddingRerankingModel = (
    modelId: string,
    settings: OllamaEmbeddingRerankingSettings = {},
  ) => {
    return new OllamaEmbeddingRerankingModel(modelId, settings, {
      client,
      provider: 'ollama.embedding-reranking',
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
  provider.reranking = createRerankingModel;
  provider.rerankingModel = createRerankingModel;
  provider.embeddingReranking = createEmbeddingRerankingModel;

  const baseURL = options.baseURL ?? 'http://127.0.0.1:11434';
  const createImageModel = (modelId: string) =>
    new OllamaImageModel(modelId, {
      provider: 'ollama',
      modelId,
      baseURL,
      headers: () => normalizedHeaders,
      fetch: options.fetch,
    });
  provider.imageModel = createImageModel;

  // Create tools with the Ollama client injected
  const toolsWithClient = {
    webSearch: (options = {}) => ollamaTools.webSearch({ ...options, client }),
    webFetch: (options = {}) => ollamaTools.webFetch({ ...options, client }),
  };

  provider.tools = toolsWithClient;
  provider.specificationVersion = 'v3' as const;
  provider.embeddingModel = createEmbeddingModel;

  return provider;
}

/**
 * Default Ollama provider instance for browser environments
 */
export const ollama = createOllama();
