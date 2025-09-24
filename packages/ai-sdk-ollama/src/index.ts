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

// Re-export tool calling reliability utilities for advanced users
export type {
  ToolCallingOptions,
  ResolvedToolCallingOptions,
  ToolCallResult,
  ReliableToolCallResult,
  ToolDefinition,
} from './utils/tool-calling-reliability';

export type { ObjectGenerationOptions } from './utils/object-generation-reliability';

// Enhanced wrapper functions for better Ollama tool calling reliability
export {
  generateTextOllama,
  type GenerateTextOllamaOptions,
} from './functions/generate-text-ollama';

export {
  streamTextOllama,
  type StreamTextOllamaOptions,
} from './functions/stream-text-ollama';
