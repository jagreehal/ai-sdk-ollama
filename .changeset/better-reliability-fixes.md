---
"ai-sdk-ollama": patch
---

Fix TypeScript compilation errors in examples

- Fixed variable naming conflicts in stream-vs-generate-test.ts, debug-streaming-issue.ts, generate-all-ollama-demo.ts, stream-object-ollama-demo.ts, and stream-text-ollama-demo.ts
- Fixed undefined variable 'ollamaRaw' in existing-client-example.ts  
- Fixed browser example to use createOllama() instead of passing baseURL to ollama() function
- Fixed async tool calls access in streaming examples
- Fixed Zod schema definitions for record types
- All examples now compile and run successfully
