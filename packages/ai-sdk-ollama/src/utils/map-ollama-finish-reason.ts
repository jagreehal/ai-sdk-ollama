import { LanguageModelV3FinishReason } from '@ai-sdk/provider';

// Helper function to create finish reason values
// TypeScript requires type assertion because LanguageModelV3FinishReason
// is a branded type that doesn't directly accept string literals
function createFinishReason(
  value: 'stop' | 'length' | 'unknown',
): LanguageModelV3FinishReason {
  // @ts-expect-error - LanguageModelV3FinishReason is a branded type that requires
  // type assertion. The values 'stop', 'length', and 'unknown' are valid finish reasons.
  return value;
}

export function mapOllamaFinishReason(
  reason?: string | null,
): LanguageModelV3FinishReason {
  if (!reason) return createFinishReason('unknown');

  switch (reason) {
    case 'stop': {
      return createFinishReason('stop');
    }
    case 'length': {
      return createFinishReason('length');
    }
    default: {
      return createFinishReason('unknown');
    }
  }
}
