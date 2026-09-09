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
} from './provider.browser.js';

export {
  OllamaRerankingModel,
  type OllamaRerankingSettings,
  type OllamaRerankingProviderOptions,
} from './models/reranking-model.js';

export { OllamaError } from './utils/ollama-error.js';
export type { OllamaErrorData } from './utils/ollama-error.js';
export type {
  AbortableStream,
  OllamaClient,
  OllamaRequestOptions,
} from './ollama-client.js';

// Utility exports
export { cosineSimilarity } from './utils/cosine-similarity.js';

// Re-export tool calling reliability utilities for advanced users
export {
  parseToolArguments,
  resolveToolCallingOptions,
} from './utils/tool-calling-reliability.js';
export type {
  ToolCallingOptions,
  ResolvedToolCallingOptions,
  ToolCallResult,
  ReliableToolCallResult,
  ToolDefinition,
} from './utils/tool-calling-reliability.js';

export type { ObjectGenerationOptions } from './utils/object-generation-reliability.js';

// Enhanced wrapper functions for better Ollama tool calling reliability
export {
  generateText,
  type GenerateTextOptions,
} from './functions/generate-text.js';

export { streamText, type StreamTextOptions } from './functions/stream-text.js';
