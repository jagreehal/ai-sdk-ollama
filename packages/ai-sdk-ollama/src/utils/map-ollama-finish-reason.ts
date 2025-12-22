import { LanguageModelV3FinishReason } from '@ai-sdk/provider';

export function mapOllamaFinishReason(
  reason?: string | null,
): LanguageModelV3FinishReason {
  if (!reason) return 'unknown' as unknown as LanguageModelV3FinishReason;

  switch (reason) {
    case 'stop': {
      return 'stop' as unknown as LanguageModelV3FinishReason;
    }
    case 'length': {
      return 'length' as unknown as LanguageModelV3FinishReason;
    }
    default: {
      return 'unknown' as unknown as LanguageModelV3FinishReason;
    }
  }
}
