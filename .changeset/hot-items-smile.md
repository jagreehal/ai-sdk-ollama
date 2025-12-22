---
'ai-sdk-ollama': minor
---

### Fixed

- **Real-time streaming for flow-based UIs**: Fixed issue where `streamText`'s `fullStream` was waiting for completion before emitting events, causing flow interfaces to only receive control events (start, finish) without text or tool call events. The enhanced `fullStream` now streams all events (text-delta, tool-call, tool-result) in real-time as they occur. Resolves [#344](https://github.com/jagreehal/ai-sdk-ollama/issues/344).

### Added

- **`stopWhen` support**: Added support for the `stopWhen` property in both `streamText` and `generateText` functions, allowing users to customize multi-turn tool calling behavior. When not provided and tools are enabled, defaults to `stepCountIs(5)` for multi-turn tool calling.

### Improved

- **AI SDK compatibility**: Enhanced both `streamText` and `generateText` to automatically support all AI SDK properties using `Parameters<typeof _streamText>[0]` type extraction, ensuring 100% forward compatibility with future AI SDK changes without manual updates.
