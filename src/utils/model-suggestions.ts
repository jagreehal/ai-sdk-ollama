/**
 * Model suggestions and DX improvements for better user experience
 */

import { getModelCapabilities, ModelCapabilities } from './model-capabilities';

export interface ModelSuggestion {
  modelId: string;
  reason: string;
  capabilities: ModelCapabilities;
}

/**
 * Suggest better models based on requirements
 */
export function suggestModelsForFeatures(requirements: {
  toolCalling?: boolean;
  vision?: boolean;
  jsonMode?: boolean;
  contextSize?: 'small' | 'medium' | 'large';
  performance?: 'fast' | 'balanced' | 'quality';
}): ModelSuggestion[] {
  const suggestions: ModelSuggestion[] = [];

  // Tool calling models
  if (requirements.toolCalling) {
    suggestions.push(
      {
        modelId: 'llama3.2',
        reason: 'Excellent tool calling support with good general performance',
        capabilities: getModelCapabilities('llama3.2'),
      },
      {
        modelId: 'llama3.1:8b',
        reason: 'Strong tool calling with larger model for complex tasks',
        capabilities: getModelCapabilities('llama3.1:8b'),
      },
      {
        modelId: 'mistral',
        reason: 'Fast tool calling with multilingual support',
        capabilities: getModelCapabilities('mistral'),
      },
      {
        modelId: 'qwen2.5',
        reason: 'Excellent coding and tool calling capabilities',
        capabilities: getModelCapabilities('qwen2.5'),
      }
    );
  }

  // Vision models
  if (requirements.vision) {
    suggestions.push(
      {
        modelId: 'llama3.2-vision',
        reason: 'Best vision model with tool calling support',
        capabilities: getModelCapabilities('llama3.2-vision'),
      },
      {
        modelId: 'llava',
        reason: 'Specialized vision model for image analysis',
        capabilities: getModelCapabilities('llava'),
      },
      {
        modelId: 'minicpm-v',
        reason: 'Lightweight vision model for edge deployments',
        capabilities: getModelCapabilities('minicpm-v'),
      }
    );
  }

  // Performance-based suggestions
  if (requirements.performance === 'fast') {
    suggestions.push(
      {
        modelId: 'llama3.2:1b',
        reason: 'Fastest model with modern features',
        capabilities: getModelCapabilities('llama3.2:1b'),
      },
      {
        modelId: 'phi4-mini',
        reason: 'Optimized for speed and low resource usage',
        capabilities: getModelCapabilities('phi4-mini'),
      }
    );
  } else if (requirements.performance === 'quality') {
    suggestions.push(
      {
        modelId: 'llama3.1:70b',
        reason: 'Highest quality responses for complex tasks',
        capabilities: getModelCapabilities('llama3.1:70b'),
      },
      {
        modelId: 'mixtral',
        reason: 'Excellent reasoning and multilingual capabilities',
        capabilities: getModelCapabilities('mixtral'),
      }
    );
  }

  // Context size requirements
  if (requirements.contextSize === 'large') {
    suggestions.push(
      {
        modelId: 'llama3.2',
        reason: '128K context window for long documents',
        capabilities: getModelCapabilities('llama3.2'),
      },
      {
        modelId: 'mistral-nemo',
        reason: '128K context with excellent multilingual support',
        capabilities: getModelCapabilities('mistral-nemo'),
      }
    );
  }

  // Remove duplicates and filter based on requirements
  const uniqueSuggestions = suggestions.filter((suggestion, index, array) => 
    array.findIndex(s => s.modelId === suggestion.modelId) === index
  );

  // Filter suggestions that don't meet the requirements
  return uniqueSuggestions.filter(suggestion => {
    if (requirements.toolCalling && !suggestion.capabilities.supportsToolCalling) {
      return false;
    }
    if (requirements.vision && !suggestion.capabilities.supportsVision) {
      return false;
    }
    if (requirements.jsonMode && !suggestion.capabilities.supportsJsonMode) {
      return false;
    }
    return true;
  });
}

/**
 * Get user-friendly error messages with suggestions
 */
export function getFeatureNotSupportedMessage(
  modelId: string, 
  feature: 'toolCalling' | 'vision' | 'jsonMode'
): string {
  const suggestions = suggestModelsForFeatures({ [feature]: true });
  const topSuggestions = suggestions.slice(0, 3);

  const featureNames = {
    toolCalling: 'tool calling',
    vision: 'vision/image analysis',
    jsonMode: 'JSON mode'
  };

  let message = `Model '${modelId}' does not support ${featureNames[feature]}.`;
  
  if (topSuggestions.length > 0) {
    message += `\n\nRecommended models for ${featureNames[feature]}:`;
    for (const suggestion of topSuggestions) {
      message += `\n• ${suggestion.modelId} - ${suggestion.reason}`;
    }
  }

  return message;
}

/**
 * Validate model configuration and provide suggestions
 */
export function validateModelConfiguration(modelId: string, options: {
  hasTools?: boolean;
  hasImages?: boolean;
  needsJsonMode?: boolean;
  expectedTokens?: number;
}) {
  const capabilities = getModelCapabilities(modelId);
  const issues: string[] = [];
  const suggestions: string[] = [];

  // Check tool calling
  if (options.hasTools && !capabilities.supportsToolCalling) {
    issues.push(`Tool calling not supported by '${modelId}'`);
    const toolModels = suggestModelsForFeatures({ toolCalling: true }).slice(0, 2);
    suggestions.push(`For tool calling, consider: ${toolModels.map(m => m.modelId).join(', ')}`);
  }

  // Check vision
  if (options.hasImages && !capabilities.supportsVision) {
    issues.push(`Vision/image analysis not supported by '${modelId}'`);
    const visionModels = suggestModelsForFeatures({ vision: true }).slice(0, 2);
    suggestions.push(`For vision tasks, consider: ${visionModels.map(m => m.modelId).join(', ')}`);
  }

  // Check JSON mode
  if (options.needsJsonMode && !capabilities.supportsJsonMode) {
    issues.push(`JSON mode may not work reliably with '${modelId}'`);
    const jsonModels = suggestModelsForFeatures({ jsonMode: true }).slice(0, 2);
    suggestions.push(`For structured output, consider: ${jsonModels.map(m => m.modelId).join(', ')}`);
  }

  // Check context window
  if (options.expectedTokens && options.expectedTokens > capabilities.contextWindow) {
    issues.push(`Expected tokens (${options.expectedTokens}) exceed model context window (${capabilities.contextWindow})`);
    const largeContextModels = suggestModelsForFeatures({ contextSize: 'large' }).slice(0, 2);
    suggestions.push(`For large context, consider: ${largeContextModels.map(m => m.modelId).join(', ')}`);
  }

  return {
    isValid: issues.length === 0,
    issues,
    suggestions,
    capabilities
  };
}