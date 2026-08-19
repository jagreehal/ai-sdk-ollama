export {
  createOllama,
  ollama,
  ollamaProviderOptionsSchema,
  ollamaChatProviderOptionsSchema,
  ollamaEmbeddingProviderOptionsSchema,
  type OllamaProvider,
  type OllamaProviderSettings,
  type OllamaChatSettings,
  type OllamaEmbeddingSettings,
  type OllamaProviderOptions,
  type OllamaChatProviderOptions,
  type OllamaEmbeddingProviderOptions,
  type Options,
} from './provider.js';

export {
  OllamaRerankingModel,
  ollamaRerankingProviderOptionsSchema,
  type OllamaRerankingSettings,
  type OllamaRerankingProviderOptions,
} from './models/reranking-model.js';

export {
  OllamaEmbeddingRerankingModel,
  type OllamaEmbeddingRerankingSettings,
} from './models/embedding-reranking-model.js';

export { OllamaImageModel } from './models/image-model.js';

export { OllamaError } from './utils/ollama-error.js';
export type { OllamaErrorData } from './utils/ollama-error.js';

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

export type { RepairTextFunction } from './utils/json-text-repair.js';

export {
  cascadeRepairText,
  enhancedRepairText,
} from './utils/json-text-repair.js';

// Enhanced wrapper functions for better Ollama tool calling reliability
export {
  generateText,
  type GenerateTextOptions,
} from './functions/generate-text.js';

export { streamText, type StreamTextOptions } from './functions/stream-text.js';

// ============================================================================
// Stream Utilities
// ============================================================================
// Re-export utilities from official AI SDK
export {
  type AsyncIterableStream,
  simulateReadableStream,
  parsePartialJson,
  smoothStream,
  type ChunkDetector,
} from 'ai';

// ============================================================================
// Middleware
// ============================================================================
// Re-export middleware from official AI SDK
export {
  wrapLanguageModel,
  defaultSettingsMiddleware,
  extractReasoningMiddleware,
  simulateStreamingMiddleware,
  type LanguageModelMiddleware,
} from 'ai';

// ============================================================================
// Agent
// ============================================================================
// Re-export agent from official AI SDK
export {
  ToolLoopAgent,
  stepCountIs,
  hasToolCall,
  type ToolLoopAgentSettings,
  // Renamed in AI SDK v7: the agent now reuses the generateText callbacks.
  type GenerateTextOnFinishCallback,
  type GenerateTextOnStepFinishCallback,
  type Agent,
  type AgentCallParameters,
  type AgentStreamParameters,
} from 'ai';
