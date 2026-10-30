---
'ai-sdk-ollama': patch
---

Harden the stream for custom `OllamaClient` adapters whose iterator ends cleanly without the final `done` chunk: close any open text or reasoning block, emit an `error` part and end the stream with a `finish` part (reason `error`). The default client already throws in that case, so its streams still error as before.
