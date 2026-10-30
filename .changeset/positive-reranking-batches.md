---
'ai-sdk-ollama': patch
---

Fall back to the default embedding reranking batch size when a supplied value would round down to zero, preventing repeated empty embedding requests.
