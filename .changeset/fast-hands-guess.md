---
'ai-sdk-ollama': patch
---

Fix tool call handling in final chunk

Some models send tool_calls in the final chunk (done: true) instead of during the stream. This change checks the final chunk for tool calls and enqueues them so they aren't missed, preventing tool-calling models from failing silently.

Thanks to [@petrgrishin](https://github.com/petrgrishin) for [PR #391](https://github.com/jagreehal/ai-sdk-ollama/pull/391) - the first contribution to the repo! 🎉
