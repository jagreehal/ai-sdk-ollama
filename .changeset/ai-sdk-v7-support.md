---
'ai-sdk-ollama': major
---

Add support for Vercel AI SDK v7 (beta).

- Bump peer dependency to `ai@^7`, and dependencies to `@ai-sdk/provider@4` and `@ai-sdk/provider-utils@5`.
- Migrate all models (chat, embedding, image, reranking) to the `LanguageModelV4` / `EmbeddingModelV4` / `ImageModelV4` / `RerankingModelV4` provider specs, declaring `specificationVersion: 'v4'`.
- Read the new `SharedV4FileData` tagged file-data union for image inputs, and the consolidated `file` tool-result output type (was `image-data` / `image-url` / `file-data`). Fixes multimodal image inputs under v7.
- Update the `tool()` helper usages (web search / web fetch) for the v7 `ToolExecutionOptions` and 3-generic `Tool<INPUT, OUTPUT, CONTEXT>` signature.
- Support the new per-call `reasoning` effort option (`LanguageModelV4CallOptions.reasoning`). The provider maps `'none'`/`'minimal'`/`'low'`/`'medium'`/`'high'`/`'xhigh'`/`'provider-default'` onto Ollama's `think` parameter, overriding the model-level `think` setting, so you can set reasoning effort per request.

BREAKING: This release requires `ai@^7`. AI SDK v7 renamed the re-exported agent callback types `ToolLoopAgentOnFinishCallback` and `ToolLoopAgentOnStepFinishCallback` to `GenerateTextOnFinishCallback` and `GenerateTextOnStepFinishCallback`.
