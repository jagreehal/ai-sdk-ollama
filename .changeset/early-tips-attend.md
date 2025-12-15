---
'ai-sdk-ollama': patch
---

Add API key configuration support for cloud Ollama services

- Added `apiKey` parameter to `createOllama` options
- API key is automatically set as `Authorization: Bearer {apiKey}` header
- Existing Authorization headers take precedence over apiKey
- Added header normalization to handle Headers instances, arrays, and plain objects
- Updated README with API key configuration examples for different runtimes (Node.js, Bun, Deno, serverless)
