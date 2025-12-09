---
'ai-sdk-ollama': minor
---

Add `keep_alive` parameter support and improve type safety

### Added
- **`keep_alive` parameter**: Control how long models stay loaded in memory after requests
  - Accepts duration strings (e.g., `"10m"`, `"24h"`), numbers in seconds, negative numbers for indefinite, or `0` to unload immediately
  - Works across all chat operations (generate, stream, tool calling, object generation)

### Improved
- **Type safety**: Now uses `Pick<ChatRequest, 'keep_alive' | 'format' | 'tools'>` from the official ollama-js package
- **Type consistency**: `OllamaProviderSettings` extends `Pick<Config, 'headers' | 'fetch'>` and `OllamaEmbeddingSettings` extends `Pick<EmbedRequest, 'dimensions'>`
- **Type exports**: Re-export more types from ollama-js for better developer experience (`ChatRequest`, `EmbedRequest`, `Config`, `ToolCall`, `Tool`, `Message`, `ChatResponse`, `EmbedResponse`)
