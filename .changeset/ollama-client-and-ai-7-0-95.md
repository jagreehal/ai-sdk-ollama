---
'ai-sdk-ollama': minor
---

Track AI SDK 7.0.95 and open the provider up to custom Ollama clients.

- The `ai` peer range moves to `^7.0.95`, with `@ai-sdk/provider` and `@ai-sdk/provider-utils` updated to match.
- `OllamaClient` is a structural contract, so the official client, a maintained fork, or a custom adapter can be injected in both Node.js and browser builds. Streaming methods use the newly exported `AbortableStream` type.
- Per-request `AbortSignal`s are forwarded to the client, and an aborted request settles as a rejection across the reliability retry and fallback paths.
- Returned `message.thinking` is surfaced as AI SDK reasoning independently of the request's `think` setting, including on terminal stream chunks, and streamed text and reasoning blocks close symmetrically.
- Output usage carries the total token count Ollama reports and leaves the text/reasoning split unset, matching what the API provides.
