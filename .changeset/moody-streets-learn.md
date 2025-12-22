---
'ai-sdk-ollama': major
---

Migrate to AI SDK v6 with full compatibility and alignment with official SDK.

## Breaking Changes

- **AI SDK v6 Required**: Now requires `ai@^6.0.0` (previously `ai@^5.0.0`)
- **Removed Custom Utilities**: Deleted custom implementations of utilities now available in official AI SDK:
  - `createAsyncIterableStream`, `createStitchableStream`, `createResolvablePromise`, `fixJson`, `parsePartialJsonAsync` removed
  - Use official AI SDK exports from `'ai'` instead: `parsePartialJson`, `simulateReadableStream`, `smoothStream`
- **Removed Custom Middleware**: Deleted custom middleware implementations (`wrapLanguageModel`, `defaultSettingsMiddleware`, `extractReasoningMiddleware`, `simulateStreamingMiddleware`)
  - All middleware now re-exported from official AI SDK
- **Removed Custom Agent**: Deleted custom `ToolLoopAgent` implementation
  - Use official `ToolLoopAgent` from `'ai'` package
  - `toolCalled` helper removed, use `hasToolCall` from `'ai'` instead
- **Structured Output API**: `experimental_output` promoted to stable `output` in AI SDK v6
- **Usage Properties**: Token usage now uses `inputTokens`/`outputTokens` instead of `promptTokens`/`completionTokens`

## New Features

- **Full AI SDK v6 Compatibility**: All features align with official AI SDK v6 specification
- **Re-exported Utilities**: Stream utilities, middleware, and agents from official SDK for consistency
- **Improved Type Safety**: Full TypeScript support with LanguageModelV3 specification
- **Reranking Support**: Native reranking API support (AI SDK v6 feature)
- **MCP Support**: Full MCP integration support (OAuth, resources, prompts, elicitation)

## Migration Guide

1. **Update Dependencies**:
   ```bash
   npm install ai-sdk-ollama ai@^6.0.0
   ```

2. **Update Imports**:
   ```typescript
   // Before
   import { ToolLoopAgent, toolCalled } from 'ai-sdk-ollama';
   import { parsePartialJson } from 'ai-sdk-ollama';
   
   // After
   import { ollama } from 'ai-sdk-ollama';
   import { ToolLoopAgent, hasToolCall, parsePartialJson } from 'ai';
   ```

3. **Update Structured Output**:
   ```typescript
   // Before
   experimental_output: Output.object({ schema })
   
   // After
   output: Output.object({ schema })
   ```

4. **Update Stop Conditions**:
   ```typescript
   // Before
   stopWhen: [toolCalled('done')]
   
   // After
   stopWhen: [hasToolCall('done')]
   ```

5. **Update Usage Properties**:
   ```typescript
   // Before
   result.usage.promptTokens
   result.usage.completionTokens
   
   // After
   result.usage.inputTokens
   result.usage.outputTokens
   result.totalUsage.inputTokens // For agents
   ```

## Improvements

- **Reduced Bundle Size**: Removed duplicate implementations, now re-exporting from official SDK
- **Better Maintainability**: Aligned with official SDK to prevent drift
- **Enhanced Type Safety**: Full LanguageModelV3 specification support
- **Consistent APIs**: All utilities follow official AI SDK patterns
