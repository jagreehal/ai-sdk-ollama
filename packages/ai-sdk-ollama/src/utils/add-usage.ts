import type { LanguageModelUsage } from 'ai';

/** Unknown stays undefined: Ollama omits some counts, and 0 would claim none. */
function addCounts(a: number | undefined, b: number | undefined) {
  return a === undefined && b === undefined ? undefined : (a ?? 0) + (b ?? 0);
}

/** Sums two calls' usage. `raw` is dropped as it describes a single call. */
export function addUsage(
  a: LanguageModelUsage,
  b: LanguageModelUsage,
): LanguageModelUsage {
  return {
    inputTokens: addCounts(a.inputTokens, b.inputTokens),
    inputTokenDetails: {
      noCacheTokens: addCounts(
        a.inputTokenDetails.noCacheTokens,
        b.inputTokenDetails.noCacheTokens,
      ),
      cacheReadTokens: addCounts(
        a.inputTokenDetails.cacheReadTokens,
        b.inputTokenDetails.cacheReadTokens,
      ),
      cacheWriteTokens: addCounts(
        a.inputTokenDetails.cacheWriteTokens,
        b.inputTokenDetails.cacheWriteTokens,
      ),
    },
    outputTokens: addCounts(a.outputTokens, b.outputTokens),
    outputTokenDetails: {
      textTokens: addCounts(
        a.outputTokenDetails.textTokens,
        b.outputTokenDetails.textTokens,
      ),
      reasoningTokens: addCounts(
        a.outputTokenDetails.reasoningTokens,
        b.outputTokenDetails.reasoningTokens,
      ),
    },
    totalTokens: addCounts(a.totalTokens, b.totalTokens),
  };
}
