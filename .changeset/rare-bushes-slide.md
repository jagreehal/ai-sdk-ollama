---
'ai-sdk-ollama': minor
---

Fix streaming of reasoning (think) content so that `fullStream` correctly emits `reasoning-start`, `reasoning-delta`, and `reasoning-end` parts with a stable ID when using models with `think: true` (e.g. DeepSeek-R1, Qwen 3). Ensures the AI SDK can aggregate reasoning content and that multiple reasoning chunks from the API are represented as a single reasoning span. Message conversion now includes reasoning parts when converting assistant messages to Ollama format.
