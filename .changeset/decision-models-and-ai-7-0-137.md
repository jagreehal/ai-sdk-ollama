---
'ai-sdk-ollama': minor
---

Track AI SDK 7.0.137 and adopt its `experimental_decide` API for Ollama decision models.

- `ollama.decisionModel()` returns an `OllamaDecisionModel` that implements `DecisionModelV4` with `doDecide`. `evaluationModel()` and `OllamaEvaluationModel` stay as deprecated aliases.
- Decision state accepts text and JSON parts. A single part goes to Ollama as-is, and several parts go as a list.
- The `ai` peer range moves to `^7.0.137`, with `@ai-sdk/provider` and `@ai-sdk/provider-utils` updated to match.
- Web search docs, examples and tests use `deepseek-v4.1-flash:cloud` alongside `gpt-oss:120b-cloud`.
