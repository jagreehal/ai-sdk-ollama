---
'ai-sdk-ollama': minor
---

- **Fix:** Make `OllamaProviderOptions`, `OllamaChatProviderOptions`, and `OllamaEmbeddingProviderOptions` compatible with the AI SDK's `providerOptions` (`Record<string, JSONObject>`). They are now defined as type aliases from Zod schemas (`z.infer`), so passing e.g. `providerOptions: { ollama: { structuredOutputs: true } }` into `streamText`, `generateText`, or `ToolLoopAgent` type-checks correctly (fixes #548).

- **New:** Export provider option Zod schemas: `ollamaProviderOptionsSchema`, `ollamaChatProviderOptionsSchema`, `ollamaEmbeddingProviderOptionsSchema`, and `ollamaRerankingProviderOptionsSchema` for validation or parsing.

- **New:** Image generation support via `ollama.imageModel(modelId)` and `OllamaImageModel`, using the AI SDK's `generateImage()` and experimental Ollama image models (e.g. `x/z-image-turbo`, `x/flux2-klein`). Supports `providerOptions.ollama` (e.g. `steps`, `negative_prompt`).

- **Change:** Reranking model now uses `parseProviderOptions` from `@ai-sdk/provider-utils` for `providerOptions.ollama`; `OllamaRerankingProviderOptions` is now a type inferred from the exported schema.
