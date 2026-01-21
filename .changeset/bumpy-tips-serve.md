---
'ai-sdk-ollama': minor
---

Update examples, tests, and documentation to use `generateText` with `Output.object()` instead of deprecated `generateObject`.

- Updated all example files to use the new API pattern
- Updated integration tests to use `generateText` with `Output.object()`
- Updated documentation and README files to reflect the new API
- Updated code comments to reference the new API

This change aligns with AI SDK v6 recommendations. The deprecated `generateObject` function still works but is no longer shown in examples or documentation.
