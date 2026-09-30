---
'ai-sdk-ollama': minor
---

Add `ollama.evaluationModel()` for Ollama decision models such as `nimble` and `tev1`. Use it with the AI SDK's `experimental_evaluate` to get typed choice, boolean and score answers with probabilities from one local call.

- `OllamaClient` accepts an optional `systemone()` method.
- `generateText` and `streamText` restate the latest user message, text parts included, when they synthesise a reply from tool results.
- JSON repair serialises object values for string fields as JSON.
- Supports `ai` 7.0.103+ and `ollama` 0.6.4.
