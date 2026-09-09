---
'ai-sdk-ollama': patch
---

Preserve returned thinking as reasoning independently of the request's `think` setting, including terminal stream chunks. `think` still controls generation; returned reasoning remains separate from final text. Keep total output usage while leaving the text/reasoning token split unknown because Ollama does not report it.
