---
'ai-sdk-ollama': minor
---

Fix streaming examples and improve TypeScript type checking

- Fix "Stream error: text part not found" by using textStream instead of fullStream for basic streaming
- Fix TypeScript errors in all examples (error handling, index access, undefined checks)
- Remove rootDir restriction in tsconfig.json to enable type checking for examples
- Fix tool call parameter handling and error messages
- Remove deprecated model capabilities and suggestions utilities
- Improve error handling with proper type checking throughout examples
- Update streaming examples to work with AI SDK v5 API changes
