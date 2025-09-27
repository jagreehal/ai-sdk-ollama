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
  generateText,
  type GenerateTextOptions,
} from './functions/generate-text';

export { streamText, type StreamTextOptions } from './functions/stream-text';
