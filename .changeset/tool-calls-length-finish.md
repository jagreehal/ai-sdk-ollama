---
'ai-sdk-ollama': patch
---

Report `finishReason: 'length'` when Ollama truncates a response that contains tool calls. Before this fix the provider reported `tool-calls`, so the AI SDK ran tools from a cut-off turn (#1092).
