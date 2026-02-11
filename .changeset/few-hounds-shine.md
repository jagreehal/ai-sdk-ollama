---
'ai-sdk-ollama': minor
---

**Structured output / object generation**

- **Cascade JSON repair**: Object generation repair now uses a cascade—[jsonrepair](https://github.com/josdejong/jsonrepair) first, then the built-in Ollama-specific repair (`enhancedRepairText`) for edge cases (Python `True`/`None`, URLs with `//`, smart quotes, etc.). Repair remains on by default; use `enableTextRepair: false` or a custom `repairText` to override.
- **Exports**: `cascadeRepairText` and `enhancedRepairText` are exported for advanced use and custom repair pipelines.
- **Reliability**: Type validation after repair so non-JSON or string-wrapped output is rejected when the schema expects an object/array; fallback merge no longer spreads primitives into the result.
- **Docs & examples**: READMEs updated with cascade repair description and links; new `examples/node/src/test-cascade-repair.ts` example for repair behavior (run with `--llm` for LLM object generation).
