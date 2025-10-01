---
'ai-sdk-ollama': patch
---

Fix synthesis conflict between `messages` and `prompt` parameters in `streamText` and `generateText`. The synthesis logic now correctly detects whether the original call used `messages` or `prompt` and constructs the follow-up synthesis call accordingly, preventing "prompt field is not supported when messages is specified" errors when using the `messages` + `system` pattern with tool calling.
