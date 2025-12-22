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

export {
  OllamaRerankingModel,
  type OllamaRerankingSettings,
  type OllamaRerankingProviderOptions,
} from './models/reranking-model';

export {
  OllamaEmbeddingRerankingModel,
  type OllamaEmbeddingRerankingSettings,
} from './models/embedding-reranking-model';

export { OllamaError } from './utils/ollama-error';
export type { OllamaErrorData } from './utils/ollama-error';

// Utility exports
export { cosineSimilarity } from './utils/cosine-similarity';

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
  type ToolLoopAgentOnFinishCallback,
  type ToolLoopAgentOnStepFinishCallback,
  type Agent,
  type AgentCallParameters,
  type AgentStreamParameters,
} from 'ai';

