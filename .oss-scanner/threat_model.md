# Threat model

## What this project does

`ai-sdk-ollama` (`packages/ai-sdk-ollama`) is a Vercel AI SDK provider for Ollama. It turns AI SDK calls (`generateText`, `streamText`, `generateObject`, embeddings, reranking, images, tools) into requests to an Ollama server through the official `ollama` client, and turns the server's replies and streams back into AI SDK results. It runs in Node and in the browser (`index.browser.ts`, `provider.browser.ts`).

## Trust boundaries and where untrusted input enters

The application developer who configures the provider is trusted: `baseURL`, `headers`, `apiKey`, a custom `fetch` or a custom `ollama` client are configuration, not attacker input.

Untrusted input:

1. **Model output.** Text, tool-call names and arguments, and JSON produced by the model are attacker-influenced through prompt injection (a fetched web page, a user message, a document in context). The reliability layer parses and repairs this output: `utils/json-text-repair.ts`, `utils/tool-calling-reliability.ts`, `utils/object-generation-reliability.ts`, `utils/json-schema-coercion.ts`. Look for prototype pollution (`__proto__`, `constructor`), catastrophic regex backtracking, unbounded loops or memory, and coercion that lets output bypass the caller's schema or call a tool that was not offered.
2. **Ollama server responses.** The server may be remote, shared or compromised. Chat results and streams (`models/chat-result.ts`, `models/chat-stream.ts`), embeddings, reranking and image responses should not crash the host process, grow without bound, or smuggle content past the AI SDK's types.
3. **Built-in tools** (`tool/web-fetch.ts`, `tool/web-search.ts`). The model chooses their arguments. A URL or query from the model must not reach anything except the configured Ollama web API, and results returned to the model must respect `maxContentLength` and the timeout.
4. **Credentials.** `apiKey` becomes an `Authorization: Bearer` header. It must not be sent to a host other than the configured one, appear in error messages or thrown `OllamaError`s, or leak into logs or results.

## Components that matter most / least

- Most: the reliability and repair utilities, the stream and result mappers, header and credential handling in `provider.ts` and `ollama-client.ts`, the web tools.
- Less: `functions/` wrappers and the browser entry points (same logic, different transport).
- Out of scope: `examples/` (browser, cookbook, node demos), tests, and bugs in `ollama`, `ai` or other dependencies unless this package uses them unsafely.

## How to exercise it

- Build: `pnpm --filter ai-sdk-ollama build` (already done in the image).
- Unit tests: `pnpm --filter ai-sdk-ollama test`. They mock the Ollama client, so they run offline and are the easiest place to feed hostile model output or server responses.
- Integration tests (`test:integration`) need a live Ollama server and will not run offline.

## How we rate severity

- Critical: code execution in the host process from model output or a server response; credential sent to an attacker-controlled host.
- High: prototype pollution or schema bypass from model output that changes application behaviour; a tool call the caller did not offer being executed; API key exposed in errors, logs or results.
- Medium: denial of service (ReDoS, unbounded memory, hang) from a single model reply or server response; web tools exceeding their content or time limits.
- Low: crashes on malformed responses that the caller can catch; information disclosure of the configured base URL.
- Not a finding: anything that needs control of provider configuration, the application's own code, or the machine running it. Prompt injection alone is not a finding; what this package does with the injected output can be.

## Reports and patches

Give a minimal reproducer as a unit test that mocks the Ollama client, in the style of the existing tests next to the affected file. Keep patches minimal and include that test. Report a root cause once, not once per model type that reaches it.
