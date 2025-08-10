// Browser-specific provider that uses ollama/browser
import { NoSuchModelError } from '@ai-sdk/provider';
import { Ollama } from 'ollama/browser';
import { OllamaChatLanguageModel } from './models/chat-language-model';
import { OllamaEmbeddingModel } from './models/embedding-model';

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
  const client = new Ollama({
    host: options.baseURL,
    fetch: options.fetch,
    headers: options.headers,
  }) as any; // Cast to any to bypass type checking differences

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
 * Default Ollama provider instance for browser environments
 */
export const ollama = createOllama();
