---
'ai-sdk-ollama': patch
---

Support media/image content in tool result messages. When a tool returns `output.type === 'content'` with `image-data`, `image-url`, or `file-data` (image) parts, the provider now sends them in the tool message's `images` array to Ollama. Fixes #527.
