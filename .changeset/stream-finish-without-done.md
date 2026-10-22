---
'ai-sdk-ollama': patch
---

When the Ollama connection ends before the final `done` chunk, close any open text or reasoning block, emit an `error` part and end the stream with a `finish` part (reason `error`), so consumers see the cut instead of waiting on a part that never comes.
