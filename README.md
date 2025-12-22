# AI SDK Ollama

[![npm version](https://badge.fury.io/js/ai-sdk-ollama.svg)](https://badge.fury.io/js/ai-sdk-ollama)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9+-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-22+-green.svg)](https://nodejs.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A Vercel AI SDK v6 provider for Ollama built on the official `ollama` package. Type safe, future proof, with cross provider compatibility and native Ollama features.

> **📌 Version Compatibility**: This version (v3+) requires AI SDK v6. If you're using AI SDK v5, please use `ai-sdk-ollama@^2.2.0` instead.

## Quick Start

```bash
npm install ai-sdk-ollama ai@^6.0.0
```

```typescript
import { ollama } from 'ai-sdk-ollama';
import { generateText } from 'ai';

// Works in both Node.js and browsers
const { text } = await generateText({
  model: ollama('llama3.2'),
  prompt: 'Write a haiku about coding',
  temperature: 0.8,
});

console.log(text);
```

## Key Features

- **Tool calling reliability** - Enhanced response synthesis for consistent tool execution
- **Wrapper functions** - `generateText` and `streamText` with improved response handling
- **Built-in reliability** - Default reliability features enabled automatically
- **Automatic JSON repair** - Handles common JSON formatting issues from LLM outputs
- **Web search integration** - Built-in web search and fetch tools powered by [Ollama's web search API](https://ollama.com/blog/web-search)
- **Reranking** - Document relevance ranking using embedding-based similarity
- **Middleware system** - Wrap models with `defaultSettingsMiddleware` and `extractReasoningMiddleware`
- **ToolLoopAgent** - Autonomous agents that run tool loops with configurable stop conditions
- **Streaming utilities** - `smoothStream`, `createStitchableStream`, `parsePartialJson` for stream manipulation
- **Type-safe** - Full TypeScript support with strict typing
- **Cross-environment** - Works in Node.js and browsers automatically
- **Native Ollama features** - Access to advanced options like `mirostat`, `repeat_penalty`, `num_ctx`
- **Production ready** - Addresses common Ollama integration challenges

## Enhanced Tool Calling

> **Tool Calling Enhancement**: Standard Ollama providers may execute tools but return incomplete responses. Our enhanced functions provide more reliable response synthesis.

```typescript
import { generateText, streamText } from 'ai-sdk-ollama';

// Enhanced generateText with reliable response synthesis
const { text } = await generateText({
  model: ollama('llama3.2'),
  tools: { /* your tools */ },
  prompt: 'Use the tools and explain the results'
});

// Enhanced streaming with tool execution
const { textStream } = await streamText({
  model: ollama('llama3.2'),
  tools: { /* your tools */ },
  prompt: 'Stream with tools'
});
```

### Combining Tools with Structured Output

> **Advanced Feature**: The `enableToolsWithStructuredOutput` option allows you to use both tool calling and structured output together, which is typically not possible with standard AI SDK implementations.

```typescript
import { generateText } from 'ai-sdk-ollama';
import { Output, tool } from 'ai';
import { z } from 'zod';

const weatherTool = tool({
  description: 'Get current weather for a location',
  inputSchema: z.object({
    location: z.string().describe('City name'),
  }),
  execute: async ({ location }) => ({
    location,
    temperature: 22,
    condition: 'sunny',
    humidity: 60,
  }),
});

// AI SDK v6: tools and structured output work together by default
const result = await generateText({
  model: ollama('llama3.2'),
  prompt: 'Get weather for San Francisco and provide a structured summary',
  tools: { getWeather: weatherTool },
  output: Output.object({
    schema: z.object({
      location: z.string(),
      temperature: z.number(),
      summary: z.string(),
    }),
  }),
  toolChoice: 'required',
});
// Result: Tool is called AND structured output is generated
```

## Web Search Tools

> **Web Search Integration**: Built-in web search and fetch tools powered by [Ollama's web search API](https://ollama.com/blog/web-search). Useful for accessing current information.

```typescript
import { generateText } from 'ai';
import { ollama } from 'ai-sdk-ollama';

// 🔍 Web search for current information
const { text } = await generateText({
  model: ollama('qwen3-coder:480b-cloud'), // Cloud models recommended for web search
  prompt: 'What are the latest developments in AI this week?',
  tools: {
    webSearch: ollama.tools.webSearch({ maxResults: 5 }),
  },
});

// 📄 Fetch specific web content
const { text: summary } = await generateText({
  model: ollama('gpt-oss:120b-cloud'),
  prompt: 'Summarize this article: https://example.com/article',
  tools: {
    webFetch: ollama.tools.webFetch({ maxContentLength: 5000 }),
  },
});

// 🔄 Combine search and fetch for comprehensive research
const { text: research } = await generateText({
  model: ollama('gpt-oss:120b-cloud'),
  prompt: 'Research recent TypeScript updates and provide a detailed analysis',
  tools: {
    webSearch: ollama.tools.webSearch({ maxResults: 3 }),
    webFetch: ollama.tools.webFetch(),
  },
});
```

### Web Search Prerequisites

1. **Ollama API Key**: Set `OLLAMA_API_KEY` environment variable
2. **Cloud Models**: Use cloud models for optimal web search performance:
   - `qwen3-coder:480b-cloud` - Best for general web search
   - `gpt-oss:120b-cloud` - Best for complex reasoning with web data

```bash
# Set your API key
export OLLAMA_API_KEY="your_api_key_here"

# Get your API key from: https://ollama.com/account

# Run web search examples
npx tsx examples/node/src/web-search-ai-sdk-ollama.ts basic    # Run basic example only
npx tsx examples/node/src/web-search-ai-sdk-ollama.ts combined # Run combined search and fetch
npx tsx examples/node/src/web-search-ai-sdk-ollama.ts streaming # Run streaming example
npx tsx examples/node/src/web-search-ai-sdk-ollama.ts error    # Run error handling example
```

## AI SDK Compatibility

```typescript
import { ollama } from 'ai-sdk-ollama';
import { generateText, streamText, generateObject, streamObject, embed, tool } from 'ai';
import { z } from 'zod';

// Text generation - works exactly like OpenAI, Anthropic, etc.
const { text } = await generateText({
  model: ollama('llama3.2'), // Just swap the model
  prompt: 'Write a haiku about coding',
  temperature: 0.8,
});

// Streaming text
const { textStream } = await streamText({
  model: ollama('llama3.2'),
  prompt: 'Tell me a story',
});

// Structured object generation
const { object } = await generateObject({
  model: ollama('llama3.2'),
  schema: z.object({
    name: z.string(),
    age: z.number(),
    interests: z.array(z.string()),
  }),
  prompt: 'Generate a random person profile',
});

// Streaming structured objects
const { objectStream } = await streamObject({
  model: ollama('llama3.2'),
  schema: z.object({
    step: z.string(),
    result: z.string(),
  }),
  prompt: 'Break down the process of making coffee',
});

// Embeddings
const { embedding } = await embed({
  model: ollama.embedding('nomic-embed-text'),
  value: 'Hello world',
});

console.log('Embedding dimensions:', embedding.length); // 768

// Tool calling (with enhanced reliability)
const { text, toolCalls } = await generateText({
  model: ollama('llama3.2'),
  prompt: 'What is the weather in San Francisco?',
  tools: {
    getWeather: tool({
      description: 'Get current weather for a location',
      inputSchema: z.object({
        location: z.string().describe('City name'),
      }),
      execute: async ({ location }) => ({ temp: 18, condition: 'sunny' }),
    }),
  },
});

// Image analysis (vision models like llava, bakllava)
const { text } = await generateText({
  model: ollama('llava'),
  prompt: [
    {
      role: 'user',
      content: [
        { type: 'text', text: 'Describe this image:' },
        {
          type: 'file',
          data: new URL('https://example.com/image.jpg'),
          mediaType: 'image/jpeg',
        },
      ],
    },
  ],
});

// Note: Image generation is not supported by Ollama
// Use other providers like OpenAI DALL-E for image generation
```

## Additional Examples

### Advanced Ollama Features

```typescript
// Access Ollama's advanced sampling while keeping portability
const { text } = await generateText({
  model: ollama('llama3.2', {
    options: {
      mirostat: 2, // Advanced sampling algorithm
      repeat_penalty: 1.1, // Fine-tune repetition
      num_ctx: 8192, // Larger context window
    },
  }),
  prompt: 'Write a detailed analysis',
  temperature: 0.8, // Standard AI SDK parameters still work
});
```

### Structured Object Generation

```typescript
import { generateObject } from 'ai';
import { z } from 'zod';

// Auto-detection: structured outputs enabled automatically
const { object } = await generateObject({
  model: ollama('llama3.2'),
  schema: z.object({
    name: z.string(),
    age: z.number(),
    interests: z.array(z.string()),
  }),
  prompt: 'Generate a random person profile',
});

console.log(object);
// { name: "Alice", age: 28, interests: ["reading", "hiking"] }
```

### MCP (Model Context Protocol) Integration

> **AI SDK v6 Feature**: Full MCP support including OAuth authentication, resources, prompts, and elicitation.

```typescript
import { generateText } from 'ai';
import { ollama } from 'ai-sdk-ollama';
import { createMCPClient } from '@ai-sdk/mcp';
import { Experimental_StdioMCPTransport } from '@ai-sdk/mcp/mcp-stdio';

// Connect to MCP server (stdio transport)
const mcpClient = await createMCPClient({
  transport: new Experimental_StdioMCPTransport({
    command: 'path/to/mcp-server',
    args: [], // Optional arguments
  }),
  // Or use HTTP transport for remote servers
  // transport: new HTTPMCPTransport({
  //   url: 'https://mcp-server.example.com',
  //   headers: { 'Authorization': 'Bearer token' },
  // }),
});

// Get tools from MCP server
const tools = await mcpClient.tools();

// Use MCP tools with Ollama
const { text } = await generateText({
  model: ollama('llama3.2'),
  prompt: 'Calculate 15 + 27 and get the current time',
  tools, // MCP tools automatically work with Ollama
});

// Clean up
await mcpClient.close();
```

**Prerequisites**: Install `@ai-sdk/mcp` package:
```bash
npm install @ai-sdk/mcp
```

See the [MCP Tools documentation](https://sdk.vercel.ai/docs/ai-sdk-core/tools/mcp-tools) for OAuth, resources, prompts, and elicitation support.

### Browser Usage

```typescript
// Automatic environment detection - same code works everywhere
import { ollama } from 'ai-sdk-ollama';
import { generateText } from 'ai';

const { text } = await generateText({
  model: ollama('llama3.2'),
  prompt: 'Hello from the browser!',
});
```

### Embeddings

```typescript
import { embed } from 'ai';

// Single embedding
const { embedding } = await embed({
  model: ollama.embedding('nomic-embed-text'),
  value: 'Hello world',
});

console.log('Embedding length:', embedding.length); // 768 dimensions

// Multiple embeddings
const texts = ['Hello world', 'How are you?', 'AI is amazing'];
const results = await Promise.all(
  texts.map((text) =>
    embed({
      model: ollama.embedding('nomic-embed-text'),
      value: text,
    }),
  ),
);
```

### Reranking

> **AI SDK v6 Feature**: Native reranking support for improving search results and RAG pipelines.

```typescript
import { rerank } from 'ai';
import { ollama } from 'ai-sdk-ollama';

// Rerank documents by relevance to a query
const { ranking, rerankedDocuments } = await rerank({
  model: ollama.embeddingReranking('nomic-embed-text'),
  query: 'What is machine learning?',
  documents: [
    'Machine learning is a subset of AI that learns from data.',
    'The weather is sunny today.',
    'Deep learning uses neural networks for complex patterns.',
    'I like pizza.',
  ],
  topN: 2, // Return top 2 most relevant
});

// Results sorted by relevance score
ranking.forEach((item, i) => {
  console.log(`${i + 1}. Score: ${item.score.toFixed(3)} - ${rerankedDocuments[i]}`);
});
```

### Middleware System

```typescript
import {
  ollama,
  wrapLanguageModel,
  defaultSettingsMiddleware,
  extractReasoningMiddleware,
} from 'ai-sdk-ollama';

// Apply default settings to all calls
const modelWithDefaults = wrapLanguageModel({
  model: ollama('llama3.2'),
  middleware: defaultSettingsMiddleware({
    settings: { temperature: 0.7, maxOutputTokens: 500 },
  }),
});

// Extract reasoning from <think> tags
const modelWithReasoning = wrapLanguageModel({
  model: ollama('llama3.2'),
  middleware: extractReasoningMiddleware({ tagName: 'think' }),
});

// Combine multiple middlewares
const enhancedModel = wrapLanguageModel({
  model: ollama('llama3.2'),
  middleware: [
    defaultSettingsMiddleware({ settings: { temperature: 0.5 } }),
    extractReasoningMiddleware({ tagName: 'thinking' }),
  ],
});
```

### ToolLoopAgent

```typescript
import { ollama } from 'ai-sdk-ollama';
import { ToolLoopAgent, stepCountIs, hasToolCall } from 'ai';
import { tool } from 'ai';
import { z } from 'zod';

const agent = new ToolLoopAgent({
  model: ollama('llama3.2'),
  system: 'You are a helpful assistant.',
  tools: {
    weather: tool({
      description: 'Get weather for a location',
      parameters: z.object({ location: z.string() }),
      execute: async ({ location }) => ({ temp: 72, condition: 'sunny' }),
    }),
    done: tool({
      description: 'Signal task completion',
      parameters: z.object({ summary: z.string() }),
      execute: async ({ summary }) => ({ completed: true, summary }),
    }),
  },
  stopWhen: [stepCountIs(10), hasToolCall('done')],
  onStepFinish: (step, index) => console.log(`Step ${index + 1}:`, step.finishReason),
});

const result = await agent.generate({
  prompt: 'Get the weather in Tokyo, then call done with a summary.',
});
```

### Streaming Utilities

```typescript
import { parsePartialJson, simulateReadableStream, smoothStream } from 'ai';

// Parse incomplete JSON from streams
const result = await parsePartialJson('{"name": "John", "age": 30');
if (result.state === 'repaired-parse' || result.state === 'successful-parse') {
  console.log(result.value); // { name: "John", age: 30 }
}

// Testing utility with controlled timing
const testStream = simulateReadableStream({
  chunks: ['Hello', ' ', 'World'],
  chunkDelayInMs: 100,
});

// Smooth streaming with chunking
import { streamText } from 'ai';
const result = streamText({
  model: ollama('llama3.2'),
  prompt: 'Write a story',
  experimental_transform: smoothStream({ chunking: 'word' }),
});
```

**Note**: Most streaming utilities are now available directly from the `'ai'` package. Import them from `'ai'` instead of `'ai-sdk-ollama'`.

## Prerequisites

- [Ollama](https://ollama.com) installed and running locally
- Node.js 22+ for development
- AI SDK v6 (`ai` package)

```bash
# Start Ollama
ollama serve

# Pull a model
ollama pull llama3.2
```

## Live Examples

### Node.js Examples

Complete working examples in [`examples/node`](./examples/node):

```bash
# Run any example directly
npx tsx examples/node/src/basic-chat.ts
npx tsx examples/node/src/dual-parameter-example.ts
npx tsx examples/node/src/simple-tool-test.ts
npx tsx examples/node/src/mcp-tools-example.ts         # Model Context Protocol integration
npx tsx examples/node/src/embedding-example.ts         # Vector embeddings
npx tsx examples/node/src/streaming-simple-test.ts
npx tsx examples/node/src/web-search-ai-sdk-ollama.ts        # Web search and fetch tools
npx tsx examples/node/src/web-search-ai-sdk-ollama.ts basic  # Run specific example to avoid rate limits
npx tsx examples/node/src/reasoning-example.ts         # Chain-of-thought reasoning
npx tsx examples/node/src/image-handling-example.ts    # Vision models
npx tsx examples/node/src/v6-reranking-example.ts      # Document reranking
npx tsx examples/node/src/smooth-stream-example.ts     # Smooth chunked streaming
npx tsx examples/node/src/middleware-example.ts        # Middleware system
npx tsx examples/node/src/tool-loop-agent-example.ts   # Autonomous tool agents
npx tsx examples/node/src/v6-tool-approval-example.ts # Tool execution approval (AI SDK v6)
npx tsx examples/node/src/v6-structured-output-example.ts # Structured output + tools (AI SDK v6)
npx tsx examples/node/src/v6-agent-example.ts         # Advanced agent patterns (AI SDK v6)
```

### Interactive Browser Demo

Try the live browser example at [`examples/browser`](./examples/browser):

```bash
cd examples/browser
npm install
npm run dev
```

Features real-time text generation, model configuration UI, and proper CORS setup.

## Documentation & API Reference

- **[Full Documentation](./packages/ai-sdk-ollama/README.md)** - Complete API reference and advanced features
- **[Custom Ollama Instance](./packages/ai-sdk-ollama/README.md#custom-ollama-instance)** - Connect to remote Ollama servers
- **[Tool Calling Guide](./packages/ai-sdk-ollama/README.md#tool-calling-support)** - Function calling with Ollama models
- **[Reasoning Support](./packages/ai-sdk-ollama/README.md#reasoning-support)** - Chain-of-thought with DeepSeek-R1
- **[Browser Setup](./packages/ai-sdk-ollama/README.md#browser-support)** - CORS configuration and proxy setup
- **[Reranking](./packages/ai-sdk-ollama/README.md#reranking)** - Document relevance ranking with embeddings
- **[Middleware System](./packages/ai-sdk-ollama/README.md#middleware-system)** - Model wrapping and customization
- **[ToolLoopAgent](./packages/ai-sdk-ollama/README.md#toolloopagent)** - Autonomous agents with tool loops
- **[Streaming Utilities](./packages/ai-sdk-ollama/README.md#streaming-utilities)** - Stream manipulation helpers

## Supported Models

Compatible with any model in your Ollama installation:

- **Chat**: `llama3.2`, `mistral`, `phi4-mini`, `qwen2.5`, `codellama`
- **Vision**: `llava`, `bakllava`, `llama3.2-vision`, `minicpm-v`
- **Embeddings**: `nomic-embed-text`, `all-minilm`, `mxbai-embed-large`
- **Reasoning**: `deepseek-r1:7b`, `deepseek-r1:1.5b`, `deepseek-r1:8b`
- **Cloud Models** (for web search): `qwen3-coder:480b-cloud`, `gpt-oss:120b-cloud`

## Development & Contributing

This project uses pnpm workspaces and Turborepo. Quick commands:

```bash
# Clone and setup
git clone https://github.com/jagreehal/ai-sdk-ollama.git
cd ai-sdk-ollama && pnpm install

# Build everything
pnpm build

# Run tests
pnpm test

# Run examples
npx tsx examples/node/src/basic-chat.ts
```

**Contributing**: Fork → feature branch → tests → PR. See [CLAUDE.md](./CLAUDE.md) for development guidelines.

MIT © [Jag Reehal](https://jagreehal.com)

See [LICENSE](./LICENSE) for details.
