---
'ai-sdk-ollama': minor
---

Support two AI SDK v7 provider-spec features that were previously unimplemented:

- `includeRawChunks`: `doStream` now emits `{ type: 'raw', rawValue }` parts carrying each unmodified Ollama chunk when the option is set (off by default).
- `usage.raw`: `doGenerate`/`doStream` now expose Ollama's own counters and timings (`prompt_eval_count`, `eval_count`, `total_duration`, `load_duration`, `prompt_eval_duration`, `eval_duration`) on `usage.raw`.

The streaming `finish` part now also carries the same `providerMetadata` that `doGenerate` already returned.

Internally, the two files that had grown past 1000 lines were split into focused modules with no behaviour change. `models/chat-language-model.ts` keeps the `LanguageModelV4` implementation and reliability orchestration, with request mapping in `models/chat-request.ts`, result assembly in `models/chat-result.ts`, and the streaming state machine in `models/chat-stream.ts`. `utils/object-generation-reliability.ts` keeps recovery orchestration, with JSON text repair in `utils/json-text-repair.ts` and schema fallback/coercion in `utils/json-schema-coercion.ts`. `enhancedRepairText`, `cascadeRepairText` and the `RepairTextFunction` type are still exported from the package root; only the internal module paths changed.
