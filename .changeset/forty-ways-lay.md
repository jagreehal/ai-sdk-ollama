---
'ai-sdk-ollama': patch
---

- Update `generateText` to detect and use the stable `output` option instead of the deprecated `experimental_output` when `enableToolsWithStructuredOutput` is enabled, including a two-phase tools + structured output path and an integration test to guard this behavior.
