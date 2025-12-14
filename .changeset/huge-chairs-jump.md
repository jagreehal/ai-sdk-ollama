---
'ai-sdk-ollama': major
---

## Breaking Change: Rename `reasoning` to `think`

The `reasoning` parameter in `OllamaChatSettings` has been renamed to `think` to align with Ollama's native API parameter name. This change ensures consistency with the official Ollama API and improves type safety by using `Pick<ChatRequest, 'keep_alive' | 'format' | 'tools' | 'think'>`.

### Migration Guide

**Before:**
```typescript
const model = ollama('gpt-oss:20b-cloud', { reasoning: true });
```

**After:**
```typescript
const model = ollama('gpt-oss:20b-cloud', { think: true });
```

### What Changed

- Removed `reasoning?: boolean` from `OllamaChatSettings`
- Added `think` parameter via `Pick<ChatRequest, 'keep_alive' | 'format' | 'tools' | 'think'>`
- Updated all internal references from `this.settings.reasoning` to `this.settings.think`
- Updated examples and tests to use the new `think` parameter

The functionality remains the same - only the parameter name has changed to match Ollama's API.
