# AI SDK Ollama

[![npm version](https://badge.fury.io/js/ai-sdk-ollama.svg)](https://badge.fury.io/js/ai-sdk-ollama)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9+-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-22+-green.svg)](https://nodejs.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A Vercel AI SDK v5+ provider for Ollama built on the official `ollama` package. Type safe, future proof, with cross provider compatibility and native Ollama features.

> **🚀 Reliable Tool Calling**: This provider includes built-in reliability features enabled by default, plus enhanced wrapper functions for guaranteed tool calling success:
>
> - **Standard**: `generateText({ model: ollama('llama3.2'), tools, prompt })` - works with built-in reliability
> - **Enhanced**: `generateTextOllama({ model: ollama('llama3.2'), tools, prompt })` - reliable tool calling
> - **Streaming**: `streamTextOllama()` - enhanced streaming with tool awareness
>
> **The Problem We Solve**: Standard Ollama providers often execute tools but return empty responses. Our enhanced functions guarantee complete, useful responses every time.

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

## Why Choose AI SDK Ollama?

- ✅ **Solves tool calling problems** - Response synthesis for reliable tool execution
- ✅ **Enhanced wrapper functions** - `generateTextOllama` guarantees complete responses
- ✅ **Built-in reliability** - Default reliability features enabled automatically
- ✅ **Cross-provider compatibility** - Drop-in replacement for OpenAI, Anthropic, etc.
- ✅ **Type-safe** - Full TypeScript support with strict typing
- ✅ **Cross-environment** - Works in Node.js and browsers automatically
- ✅ **Native Ollama power** - Access advanced features like `mirostat`, `repeat_penalty`, `num_ctx`
- ✅ **Production ready** - Handles the core Ollama limitations other providers struggle with

## More Examples

### Streaming Responses

```typescript
import { streamText } from 'ai';

const { textStream } = await streamText({
  model: ollama('llama3.2'),
  prompt: 'Tell me a story about a robot',
});

for await (const chunk of textStream) {
  process.stdout.write(chunk);
}
```

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

### Tool Calling

```typescript
import { z } from 'zod';
import { generateText, tool } from 'ai';

const { text, toolCalls } = await generateText({
  model: ollama('llama3.2'),
  prompt: 'What is the weather in San Francisco?',
  tools: {
    getWeather: tool({
      description: 'Get current weather for a location',
      inputSchema: z.object({
        location: z.string().describe('City name'),
        unit: z.enum(['celsius', 'fahrenheit']).optional(),
      }),
      execute: async ({ location, unit = 'celsius' }) => {
        return { temp: 18, unit, condition: 'sunny' };
      },
    }),
  },
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

### Enhanced Tool Calling Functions

Get reliable tool calling with our enhanced wrapper functions that guarantee complete responses:

```typescript
import { ollama, generateTextOllama, streamTextOllama } from 'ai-sdk-ollama';
import { tool } from 'ai';
import { z } from 'zod';

// Enhanced generateText with automatic response synthesis
const result = await generateTextOllama({
  model: ollama('llama3.2'),
  prompt: 'Calculate 15 + 27 using the math tool and explain the result',
  tools: {
    math: tool({
      description: 'Perform math calculations',
      inputSchema: z.object({
        operation: z.string().describe('Math operation like "15 + 27"'),
      }),
      execute: async ({ operation }) => {
        return { result: eval(operation), operation };
      },
    }),
  },
  // Optional: Configure reliability behavior
  enhancedOptions: {
    enableSynthesis: true, // Default: true
    maxSynthesisAttempts: 2, // Default: 2
    minResponseLength: 10, // Default: 10
  },
});

console.log(result.text);
// "15 + 27 equals 42. Using the math tool, I calculated that the sum is 42."
// ✅ Complete response guaranteed, unlike standard functions

// Compare with standard generateText (may return empty text after tool execution)
const standardResult = await generateText({
  model: ollama('llama3.2'),
  prompt: 'Calculate 15 + 27 using the math tool',
  tools: { math: mathTool },
});
// ⚠️ May execute tool but return empty text - common Ollama limitation
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
npx tsx examples/node/basic-chat.ts
npx tsx examples/node/dual-parameter-example.ts
npx tsx examples/node/tool-calling-example.ts
npx tsx examples/node/tools-no-parameters.ts  # Fixes rival provider issues
npx tsx examples/node/mcp-tools-example.ts     # Model Context Protocol integration
npx tsx examples/node/embedding-example.ts     # Vector embeddings
npx tsx examples/node/streaming-simple-test.ts
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

📚 **[Full Documentation](./packages/ai-sdk-ollama/README.md)** - Complete API reference and advanced features

🔧 **[Custom Ollama Instance](./packages/ai-sdk-ollama/README.md#custom-ollama-instance)** - Connect to remote Ollama servers

🛠️ **[Tool Calling Guide](./packages/ai-sdk-ollama/README.md#tool-calling-support)** - Function calling with Ollama models

🧠 **[Reasoning Support](./packages/ai-sdk-ollama/README.md#reasoning-support)** - Chain-of-thought with DeepSeek-R1

🌐 **[Browser Setup](./packages/ai-sdk-ollama/README.md#browser-support)** - CORS configuration and proxy setup

## Supported Models

Works with any model in your Ollama installation:

- **Chat**: `llama3.2`, `mistral`, `phi4-mini`, `qwen2.5`, `codellama`
- **Vision**: `llava`, `bakllava`, `llama3.2-vision`, `minicpm-v`
- **Embeddings**: `nomic-embed-text`, `all-minilm`, `mxbai-embed-large`
- **Reasoning**: `deepseek-r1:7b`, `deepseek-r1:1.5b`, `deepseek-r1:8b`

## Development & Contributing

This is a monorepo using pnpm workspaces and Turborepo. Quick commands:

```bash
# Clone and setup
git clone https://github.com/jagreehal/ai-sdk-ollama.git
cd ai-sdk-ollama && pnpm install

# Build everything
pnpm build

# Run tests
pnpm test

# Run examples
npx tsx examples/node/basic-chat.ts
```

**Contributing**: Fork → feature branch → tests → PR. See [CLAUDE.md](./CLAUDE.md) for detailed development guidelines.

MIT © [Jag Reehal](https://jagreehal.com)

See [LICENSE](./LICENSE) for details.
