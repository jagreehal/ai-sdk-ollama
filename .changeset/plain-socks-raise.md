---
'ai-sdk-ollama': minor
---

Add MCP Apps examples demonstrating the host flow for ui:// resources

- Node example: connect with mcpAppClientCapabilities, split tools by visibility, generateText with model-visible tools, read and fingerprint ui:// HTML resource, simulate iframe proxy allow/deny
- Browser example: Vite dev server hosts MCP Apps sandbox, proxies read-resource and call-tool requests, renders interactive dashboard via experimental_MCPAppRenderer
- Shared stdio MCP server with dashboard resource, model+app tool, and app-only refresh tool
