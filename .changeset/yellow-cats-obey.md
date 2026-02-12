---
'ai-sdk-ollama': minor
---

Use jsonrepair for tool-call argument parsing

- **Tool-call JSON repair**: `parseToolArguments` now uses [jsonrepair](https://github.com/josdejong/jsonrepair) when `JSON.parse` fails, so malformed tool-argument strings (trailing commas, unquoted keys, single quotes) are repaired instead of returning `{}`. Same logic is used when converting messages in `convertToOllamaChatMessages`.
- **Quoted/double-encoded JSON**: When the model returns a quoted JSON string (e.g. `"{\"query\":\"weather\"}"`), the inner JSON is now parsed so tool arguments are not lost.
- **Exports**: `parseToolArguments` and `resolveToolCallingOptions` are now exported from the main and browser entry points for advanced use.
- **Example**: New `tool-json-repair-example.ts` in examples/node demonstrates tool-argument repair; `json-repair-example.ts` and README updated to reference it.
