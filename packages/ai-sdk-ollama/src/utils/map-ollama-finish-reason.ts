import { LanguageModelV3FinishReason } from '@ai-sdk/provider';

/**
 * Maps Ollama finish reasons to the AI SDK V3 LanguageModelV3FinishReason format.
 *
 * In V3, FinishReason is an object with:
 * - unified: standardized reason ('stop', 'length', 'content-filter', 'tool-calls', 'error', 'other')
 * - raw: the original reason string from the provider
 */
export function mapOllamaFinishReason(
  reason?: string | null,
): LanguageModelV3FinishReason {
  // Map Ollama's finish reasons to AI SDK V3 unified format
  // Default to 'stop' for undefined/null reasons (normal completion)
  if (!reason) {
    return {
      unified: 'stop',
      raw: undefined,
    };
  }

  switch (reason) {
    case 'stop': {
      return {
        unified: 'stop',
        raw: reason,
      };
    }
    case 'length': {
      return {
        unified: 'length',
        raw: reason,
      };
    }
    default: {
      return {
        unified: 'other',
        raw: reason,
      };
    }
  }
}
