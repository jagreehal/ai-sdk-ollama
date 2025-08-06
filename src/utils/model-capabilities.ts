/**
 * Model capabilities detection for Ollama models
 * This helps provide better DX by abstracting model-specific limitations
 */

export interface ModelCapabilities {
  supportsToolCalling: boolean;
  supportsVision: boolean;
  supportsJsonMode: boolean;
  contextWindow: number;
  recommendedFor: string[];
}

/**
 * Known model capabilities based on model family and version
 * This is regularly updated as new models are released
 */
const MODEL_CAPABILITIES: Record<string, ModelCapabilities> = {
  // Llama family
  'llama3.2': {
    supportsToolCalling: true,
    supportsVision: false,
    supportsJsonMode: true,
    contextWindow: 128_000,
    recommendedFor: ['general', 'coding', 'reasoning'],
  },
  'llama3.2:1b': {
    supportsToolCalling: true,
    supportsVision: false,
    supportsJsonMode: true,
    contextWindow: 128_000,
    recommendedFor: ['lightweight', 'edge'],
  },
  'llama3.2:3b': {
    supportsToolCalling: true,
    supportsVision: false,
    supportsJsonMode: true,
    contextWindow: 128_000,
    recommendedFor: ['balanced', 'general'],
  },
  'llama3.2-vision': {
    supportsToolCalling: true,
    supportsVision: true,
    supportsJsonMode: true,
    contextWindow: 128_000,
    recommendedFor: ['vision', 'multimodal'],
  },
  'llama3.1': {
    supportsToolCalling: true,
    supportsVision: false,
    supportsJsonMode: true,
    contextWindow: 128_000,
    recommendedFor: ['general', 'coding', 'reasoning'],
  },
  'llama3.1:8b': {
    supportsToolCalling: true,
    supportsVision: false,
    supportsJsonMode: true,
    contextWindow: 128_000,
    recommendedFor: ['general', 'balanced'],
  },
  'llama3.1:70b': {
    supportsToolCalling: true,
    supportsVision: false,
    supportsJsonMode: true,
    contextWindow: 128_000,
    recommendedFor: ['complex', 'reasoning', 'professional'],
  },
  'llama3.1:405b': {
    supportsToolCalling: true,
    supportsVision: false,
    supportsJsonMode: true,
    contextWindow: 128_000,
    recommendedFor: ['enterprise', 'complex', 'research'],
  },
  llama3: {
    supportsToolCalling: false, // Older Llama 3 doesn't support tools
    supportsVision: false,
    supportsJsonMode: true,
    contextWindow: 8192,
    recommendedFor: ['general', 'legacy'],
  },
  llama2: {
    supportsToolCalling: false,
    supportsVision: false,
    supportsJsonMode: false,
    contextWindow: 4096,
    recommendedFor: ['legacy'],
  },

  // Mistral family
  mistral: {
    supportsToolCalling: true,
    supportsVision: false,
    supportsJsonMode: true,
    contextWindow: 32_768,
    recommendedFor: ['general', 'multilingual'],
  },
  'mistral-nemo': {
    supportsToolCalling: true,
    supportsVision: false,
    supportsJsonMode: true,
    contextWindow: 128_000,
    recommendedFor: ['general', 'multilingual', 'long-context'],
  },
  mixtral: {
    supportsToolCalling: true,
    supportsVision: false,
    supportsJsonMode: true,
    contextWindow: 32_768,
    recommendedFor: ['complex', 'reasoning', 'multilingual'],
  },

  // Phi family
  phi3: {
    supportsToolCalling: false, // Most Phi models don't support tools yet
    supportsVision: false,
    supportsJsonMode: true,
    contextWindow: 128_000,
    recommendedFor: ['lightweight', 'mobile'],
  },
  'phi3.5': {
    supportsToolCalling: false,
    supportsVision: false,
    supportsJsonMode: true,
    contextWindow: 128_000,
    recommendedFor: ['lightweight', 'mobile'],
  },
  'phi4-mini': {
    supportsToolCalling: false,
    supportsVision: false,
    supportsJsonMode: true,
    contextWindow: 128_000,
    recommendedFor: ['lightweight', 'mobile', 'edge'],
  },

  // Qwen family
  'qwen2.5': {
    supportsToolCalling: true,
    supportsVision: false,
    supportsJsonMode: true,
    contextWindow: 32_768,
    recommendedFor: ['general', 'multilingual', 'coding'],
  },
  'qwen2.5-coder': {
    supportsToolCalling: true,
    supportsVision: false,
    supportsJsonMode: true,
    contextWindow: 32_768,
    recommendedFor: ['coding', 'development'],
  },
  qwen2: {
    supportsToolCalling: true,
    supportsVision: false,
    supportsJsonMode: true,
    contextWindow: 32_768,
    recommendedFor: ['general', 'multilingual'],
  },

  // Gemma family
  gemma2: {
    supportsToolCalling: false,
    supportsVision: false,
    supportsJsonMode: true,
    contextWindow: 8192,
    recommendedFor: ['general', 'research'],
  },
  gemma: {
    supportsToolCalling: false,
    supportsVision: false,
    supportsJsonMode: true,
    contextWindow: 8192,
    recommendedFor: ['general', 'research'],
  },

  // Vision models
  llava: {
    supportsToolCalling: false,
    supportsVision: true,
    supportsJsonMode: true,
    contextWindow: 4096,
    recommendedFor: ['vision', 'image-analysis'],
  },
  'minicpm-v': {
    supportsToolCalling: false,
    supportsVision: true,
    supportsJsonMode: true,
    contextWindow: 8192,
    recommendedFor: ['vision', 'lightweight'],
  },
  bakllava: {
    supportsToolCalling: false,
    supportsVision: true,
    supportsJsonMode: true,
    contextWindow: 4096,
    recommendedFor: ['vision', 'image-analysis'],
  },

  // Coding models
  codellama: {
    supportsToolCalling: false,
    supportsVision: false,
    supportsJsonMode: true,
    contextWindow: 16_384,
    recommendedFor: ['coding', 'development'],
  },
  'deepseek-coder': {
    supportsToolCalling: false,
    supportsVision: false,
    supportsJsonMode: true,
    contextWindow: 16_384,
    recommendedFor: ['coding', 'development'],
  },

  // Command-R family (Cohere)
  'command-r': {
    supportsToolCalling: true,
    supportsVision: false,
    supportsJsonMode: true,
    contextWindow: 128_000,
    recommendedFor: ['enterprise', 'rag', 'reasoning'],
  },
  'command-r-plus': {
    supportsToolCalling: true,
    supportsVision: false,
    supportsJsonMode: true,
    contextWindow: 128_000,
    recommendedFor: ['enterprise', 'complex', 'rag'],
  },

  // Firefunction
  'firefunction-v2': {
    supportsToolCalling: true,
    supportsVision: false,
    supportsJsonMode: true,
    contextWindow: 32_768,
    recommendedFor: ['tools', 'function-calling'],
  },
};

/**
 * Get capabilities for a specific model
 */
export function getModelCapabilities(modelId: string): ModelCapabilities {
  // Normalize model ID by removing size suffixes and version tags
  const normalizedId = normalizeModelId(modelId);

  // Try exact match first
  if (MODEL_CAPABILITIES[normalizedId]) {
    return MODEL_CAPABILITIES[normalizedId];
  }

  // Try base model family match
  const baseFamily = getModelFamily(normalizedId);
  if (MODEL_CAPABILITIES[baseFamily]) {
    return MODEL_CAPABILITIES[baseFamily];
  }

  // Default capabilities for unknown models (conservative)
  return {
    supportsToolCalling: false,
    supportsVision: false,
    supportsJsonMode: false,
    contextWindow: 4096,
    recommendedFor: ['unknown'],
  };
}

/**
 * Normalize model ID for capability lookup
 */
function normalizeModelId(modelId: string): string {
  // Remove common prefixes and suffixes
  return modelId
    .toLowerCase()
    .replace(/^ollama\//, '') // Remove ollama/ prefix
    .replace(/:latest$/, '') // Remove :latest suffix
    .replace(/-instruct$/, '') // Remove -instruct suffix
    .replace(/-chat$/, ''); // Remove -chat suffix
}

/**
 * Extract model family from model ID
 */
function getModelFamily(modelId: string): string {
  const normalized = normalizeModelId(modelId);

  // Extract base family name
  if (normalized.includes('llama3.2')) return 'llama3.2';
  if (normalized.includes('llama3.1')) return 'llama3.1';
  if (normalized.includes('llama3')) return 'llama3';
  if (normalized.includes('llama2')) return 'llama2';
  if (normalized.includes('mistral')) return 'mistral';
  if (normalized.includes('mixtral')) return 'mixtral';
  if (normalized.includes('phi4')) return 'phi4-mini';
  if (normalized.includes('phi3.5')) return 'phi3.5';
  if (normalized.includes('phi3')) return 'phi3';
  if (normalized.includes('qwen2.5')) return 'qwen2.5';
  if (normalized.includes('qwen2')) return 'qwen2';
  if (normalized.includes('gemma2')) return 'gemma2';
  if (normalized.includes('gemma')) return 'gemma';
  if (normalized.includes('command-r-plus')) return 'command-r-plus';
  if (normalized.includes('command-r')) return 'command-r';
  if (normalized.includes('firefunction')) return 'firefunction-v2';
  if (normalized.includes('codellama')) return 'codellama';
  if (normalized.includes('deepseek')) return 'deepseek-coder';
  if (normalized.includes('llava')) return 'llava';
  if (normalized.includes('minicpm')) return 'minicpm-v';
  if (normalized.includes('bakllava')) return 'bakllava';

  return normalized;
}

/**
 * Check if a model supports a specific feature
 */
export function modelSupports(
  modelId: string,
  feature: keyof ModelCapabilities,
): boolean {
  const capabilities = getModelCapabilities(modelId);
  return Boolean(capabilities[feature]);
}

/**
 * Get user-friendly model information
 */
export function getModelInfo(modelId: string) {
  const capabilities = getModelCapabilities(modelId);
  const normalized = normalizeModelId(modelId);

  return {
    modelId: normalized,
    capabilities,
    isSupported: capabilities.recommendedFor[0] !== 'unknown',
  };
}
