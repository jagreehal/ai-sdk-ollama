---
'ai-sdk-ollama': patch
---

Abort the Ollama request when the stream returned by `doStream` is cancelled, so the server stops generating once the consumer stops reading.
