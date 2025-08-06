export {
  createOllama,
  ollama,
  type OllamaProvider,
  type OllamaProviderSettings,
  type OllamaChatSettings,
  type OllamaEmbeddingSettings,
} from './provider';

export { OllamaChatLanguageModel } from './models/chat-language-model';
export { OllamaEmbeddingModel } from './models/embedding-model';
export { OllamaError } from './utils/ollama-error';

// Model capabilities and suggestions utilities (optional for advanced users)
export {
  getModelCapabilities,
  getModelInfo,
  modelSupports,
  type ModelCapabilities,
} from './utils/model-capabilities';
export {
  suggestModelsForFeatures,
  getFeatureNotSupportedMessage,
  type ModelSuggestion,
} from './utils/model-suggestions';
export { validateModel, getModelStatus } from './utils/validate-model';
