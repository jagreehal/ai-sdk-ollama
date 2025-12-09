import { LanguageModelV3FinishReason } from '@ai-sdk/provider';

export function mapOllamaFinishReason(
  reason?: string | null,
): LanguageModelV3FinishReason {
  if (!reason) return 'unknown';

  switch (reason) {
    case 'stop': {
      return 'stop';
    }
    case 'length': {
      return 'length';
    }
    default: {
      return 'unknown';
    }
  }
}
