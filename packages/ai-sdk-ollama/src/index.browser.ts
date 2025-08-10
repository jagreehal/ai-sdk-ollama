// Browser entry point - uses ollama/browser
export {
  createOllama,
  ollama,
  type OllamaProvider,
  type OllamaProviderSettings,
  type OllamaChatSettings,
  type OllamaEmbeddingSettings,
  type OllamaProviderOptions,
  type OllamaChatProviderOptions,
  type OllamaEmbeddingProviderOptions,
} from './provider.browser';

export { OllamaChatLanguageModel } from './models/chat-language-model';
export type { OllamaChatConfig } from './models/chat-language-model';
export { OllamaEmbeddingModel } from './models/embedding-model';
export type { OllamaEmbeddingConfig } from './models/embedding-model';
export { OllamaError } from './utils/ollama-error';
export type { OllamaErrorData } from './utils/ollama-error';
