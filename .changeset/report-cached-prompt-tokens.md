---
'ai-sdk-ollama': patch
---

Report Ollama's `prompt_eval_cached_count` as `usage.inputTokens.cacheRead` (and in `usage.raw`).
