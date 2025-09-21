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
  type Options,
} from './provider';

export { OllamaError } from './utils/ollama-error';
export type { OllamaErrorData } from './utils/ollama-error';

// Ollama-specific wrapper functions
export {
  generateTextOllama,
  type GenerateTextOllamaOptions,
} from './ai-functions/generate-text-ollama';
export {
  generateObjectOllama,
  type GenerateObjectOllamaOptions,
} from './ai-functions/generate-object-ollama';
export {
  streamTextOllama,
  type StreamTextOllamaOptions,
} from './ai-functions/stream-text-ollama';
export {
  streamObjectOllama,
  type StreamObjectOllamaOptions,
} from './ai-functions/stream-object-ollama';
