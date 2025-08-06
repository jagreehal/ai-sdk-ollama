/**
 * Model validation utilities for better DX
 */

import { getModelCapabilities } from './model-capabilities';
import { validateModelConfiguration } from './model-suggestions';

/**
 * Validate model and provide helpful feedback
 */
export function validateModel(
  modelId: string,
  context?: {
    hasTools?: boolean;
    hasImages?: boolean;
    needsJsonMode?: boolean;
    expectedTokens?: number;
  },
) {
  const validation = validateModelConfiguration(modelId, context || {});

  // No console logging - let errors be thrown where appropriate
  // The calling code should handle errors explicitly

  return validation;
}

/**
 * Get user-friendly model status
 */
export function getModelStatus(modelId: string) {
  const capabilities = getModelCapabilities(modelId);

  const status = {
    isKnown: capabilities.recommendedFor[0] !== 'unknown',
    features: {
      toolCalling: capabilities.supportsToolCalling,
      vision: capabilities.supportsVision,
      jsonMode: capabilities.supportsJsonMode,
    },
    contextWindow: capabilities.contextWindow,
    recommendedFor: capabilities.recommendedFor,
    isLegacy: capabilities.recommendedFor.includes('legacy'),
  };

  return status;
}
