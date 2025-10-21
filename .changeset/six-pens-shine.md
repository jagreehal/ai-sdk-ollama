---
'ai-sdk-ollama': major
---

## Fixed Tool Calling Message Conversion

Fixed critical issues with tool calling message conversion that were preventing proper multi-turn conversations:

### Changes

- **Tool result messages**: Now use proper `role: 'tool'` with `tool_name` field instead of `role: 'user'` with `[Tool Result]:` prefix
- **Assistant messages**: Properly include `tool_calls` array for tool execution
- **Finish reason handling**: Returns `'tool-calls'` when tools execute to enable conversation continuation
- **Reliable tool calling**: Disabled by default (`?? false`) for better AI SDK compatibility
- **Test updates**: Updated all test expectations to match new message format

### Impact

- ✅ Standard AI SDK `generateText` and `streamText` now work perfectly with ai-sdk-ollama provider
- ✅ Full compatibility with AI SDK ecosystem and multi-turn tool calling
- ✅ Enhanced functions still provide synthesis and reliability features when needed
- ✅ Users can choose between standard (compatible) or enhanced (reliable) approaches

This ensures both standard AI SDK patterns and enhanced ai-sdk-ollama functions work seamlessly for tool calling scenarios.
