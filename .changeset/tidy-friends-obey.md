---
'ai-sdk-ollama': minor
---

Enhanced `streamText` wrapper to support `fullStream` with synthesis

- Added synthesis support for `fullStream` in addition to `textStream`
- When tool-calling models (like `gpt-oss:120b`) invoke tools without generating text first, the enhanced `fullStream` now automatically synthesizes a response based on tool results
- Emits proper `TextStreamPart` events (`text-start`, `text-delta`, `text-end`) for flow-based UIs
- Fixes issue where flow interfaces only received control events (`start`, `finish`) without any text content when models called tools first
