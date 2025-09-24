---
'ai-sdk-ollama': minor
---

Enhanced tool calling with reliable wrapper functions

## What's New

- **New Enhanced Wrapper Functions**: Added `generateTextOllama()` and `streamTextOllama()` for guaranteed tool calling reliability
- **Automatic Response Synthesis**: Enhanced functions automatically complete responses when tools are executed but return empty text
- **Configurable Reliability Options**: Control synthesis behavior with `enhancedOptions` parameter
- **Improved Documentation**: Comprehensive examples and comparison tables for standard vs enhanced functions

## Key Features

- **Reliable Tool Calling**: Standard `generateText()` may return empty responses after tool execution. Enhanced wrappers guarantee complete, useful responses every time
- **Backward Compatible**: All existing code continues to work unchanged
- **Production Ready**: Designed for critical applications that can't handle unpredictable empty responses
- **Cross Provider Compatible**: Enhanced functions work with any AI SDK provider

## Breaking Changes

None - this is a purely additive enhancement.

## Migration

No migration required. Existing code works unchanged. To get enhanced reliability:

```typescript
// Before (may return empty text after tool calls)
const { text } = await generateText({ model: ollama('llama3.2'), tools, prompt });

// After (guaranteed complete responses)
const { text } = await generateTextOllama({ model: ollama('llama3.2'), tools, prompt });
```
