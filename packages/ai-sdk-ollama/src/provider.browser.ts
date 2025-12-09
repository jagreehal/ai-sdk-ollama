// Browser-specific provider that uses ollama/browser
import { NoSuchModelError } from '@ai-sdk/provider';
import { Ollama as OllamaBrowser } from 'ollama/browser';
import type { Ollama } from 'ollama';
import { OllamaChatLanguageModel } from './models/chat-language-model';
import { OllamaEmbeddingModel } from './models/embedding-model';
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
 * Create an Ollama provider instance for browser environments
 */
export function createOllama(
  options: OllamaProviderSettings = {},
): OllamaProvider {
  // Create browser-compatible Ollama client
  // Cast to Ollama type for compatibility with shared model code
  const client = new OllamaBrowser({
    host: options.baseURL,
    fetch: options.fetch,
    headers: options.headers,
  }) as unknown as Ollama;

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

  // Create tools with the Ollama client injected
  const toolsWithClient = {
    webSearch: (options = {}) => ollamaTools.webSearch({ ...options, client }),
    webFetch: (options = {}) => ollamaTools.webFetch({ ...options, client }),
  };

  provider.tools = toolsWithClient;

  return provider as unknown as OllamaProvider;
}

/**
 * Default Ollama provider instance for browser environments
 */
export const ollama = createOllama();
