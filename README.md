# AI SDK Ollama

[![npm version](https://badge.fury.io/js/ai-sdk-ollama.svg)](https://badge.fury.io/js/ai-sdk-ollama)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9+-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-22+-green.svg)](https://nodejs.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A Vercel AI SDK v5+ provider for Ollama built on the official `ollama` package. Type safe, future proof, with cross provider compatibility and native Ollama features.

## Quick Start

```bash
npm install ai-sdk-ollama ai@^5.0.0
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

// Standard behavior: tools are bypassed when using experimental_output
const standardResult = await generateText({
  model: ollama('llama3.2'),
  prompt: 'Get weather for San Francisco and provide a structured summary',
  tools: { getWeather: weatherTool },
  experimental_output: Output.object({
    schema: z.object({
      location: z.string(),
      temperature: z.number(),
      summary: z.string(),
    }),
  }),
  toolChoice: 'required',
});
// Result: 0 tool calls, model generates placeholder data

// Enhanced behavior: tools are called AND structured output is generated
const enhancedResult = await generateText({
  model: ollama('llama3.2'),
  prompt: 'Get weather for San Francisco and provide a structured summary',
  tools: { getWeather: weatherTool },
  experimental_output: Output.object({
    schema: z.object({
      location: z.string(),
      temperature: z.number(),
      summary: z.string(),
    }),
  }),
  toolChoice: 'required',
  enhancedOptions: {
    enableToolsWithStructuredOutput: true, // Enable both features together
  },
});
// Result: 1 tool call, real data from tool used in structured output
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
npx tsx examples/node/src/web-search-example.ts basic    # Run basic example only
npx tsx examples/node/src/web-search-example.ts combined # Run combined search and fetch
npx tsx examples/node/src/web-search-example.ts streaming # Run streaming example
npx tsx examples/node/src/web-search-example.ts error    # Run error handling example
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

```typescript
import { generateText, experimental_createMCPClient } from 'ai';

// Connect to MCP server for external tools
const mcpClient = await experimental_createMCPClient({
  transport: {
    type: 'stdio',
    command: 'path/to/mcp-server',
  },
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

## Prerequisites

- [Ollama](https://ollama.com) installed and running locally
- Node.js 22+ for development
- AI SDK v5+ (`ai` package)

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
npx tsx examples/node/src/mcp-tools-example.ts     # Model Context Protocol integration
npx tsx examples/node/src/embedding-example.ts     # Vector embeddings
npx tsx examples/node/src/streaming-simple-test.ts
npx tsx examples/node/src/web-search-example.ts    # Web search and fetch tools
npx tsx examples/node/src/web-search-example.ts basic    # Run specific example to avoid rate limits
npx tsx examples/node/src/reasoning-example.ts     # Chain-of-thought reasoning
npx tsx examples/node/src/image-handling-example.ts # Vision models
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
