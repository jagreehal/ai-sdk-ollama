# AI SDK Ollama Provider

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

## Why Choose AI SDK Ollama?

- ✅ **Solves tool calling problems** - Response synthesis for reliable tool execution
- ✅ **Enhanced wrapper functions** - `generateText` and `streamText` guarantees complete responses
- ✅ **Built-in reliability** - Default reliability features enabled automatically
- ✅ **Automatic JSON repair** - Fixes 14+ types of malformed JSON from LLM outputs (trailing commas, comments, URLs, Python constants, etc.)
- ✅ **Web search and fetch tools** - Built-in web search and fetch tools powered by [Ollama's web search API](https://ollama.com/blog/web-search). Perfect for getting current information and reducing hallucinations.
- ✅ **Type-safe** - Full TypeScript support with strict typing
- ✅ **Cross-environment** - Works in Node.js and browsers automatically
- ✅ **Native Ollama power** - Access advanced features like `mirostat`, `repeat_penalty`, `num_ctx`
- ✅ **Production ready** - Handles the core Ollama limitations other providers struggle with

## Enhanced Tool Calling

> **🚀 The Problem We Solve**: Standard Ollama providers often execute tools but return empty responses. Our enhanced functions guarantee complete, useful responses every time.

```typescript
import { generateText, streamText } from 'ai-sdk-ollama';

// ✅ Enhanced generateText - guaranteed complete responses
const { text } = await generateText({
  model: ollama('llama3.2'),
  tools: {
    /* your tools */
  },
  prompt: 'Use the tools and explain the results',
});

// ✅ Enhanced streaming - tool-aware streaming
const { textStream } = await streamText({
  model: ollama('llama3.2'),
  tools: {
    /* your tools */
  },
  prompt: 'Stream with tools',
});
```

## Web Search Tools

> **🌐 New in v0.9.0**: Built-in web search and fetch tools powered by [Ollama's web search API](https://ollama.com/blog/web-search). Perfect for getting current information and reducing hallucinations.

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
```

## Contents

- [AI SDK Ollama Provider](#ai-sdk-ollama-provider)
  - [Quick Start](#quick-start)
  - [Why Choose AI SDK Ollama?](#why-choose-ai-sdk-ollama)
  - [Enhanced Tool Calling](#enhanced-tool-calling)
  - [Web Search Tools](#web-search-tools)
    - [Web Search Prerequisites](#web-search-prerequisites)
  - [Contents](#contents)
  - [Prerequisites](#prerequisites)
  - [Browser Support](#browser-support)
    - [Browser Usage](#browser-usage)
    - [Explicit Browser Import](#explicit-browser-import)
    - [CORS Configuration](#cors-configuration)
  - [More Examples](#more-examples)
    - [Cross Provider Compatibility](#cross-provider-compatibility)
    - [Native Ollama Power](#native-ollama-power)
    - [Enhanced Tool Calling Wrappers](#enhanced-tool-calling-wrappers)
    - [Combining Tools with Structured Output](#combining-tools-with-structured-output)
    - [Simple and Predictable](#simple-and-predictable)
  - [Advanced Features](#advanced-features)
    - [Custom Ollama Instance](#custom-ollama-instance)
    - [Using Existing Ollama Client](#using-existing-ollama-client)
    - [Structured Output](#structured-output)
    - [Auto-Detection of Structured Outputs](#auto-detection-of-structured-outputs)
    - [Automatic JSON Repair](#automatic-json-repair)
    - [Reasoning Support](#reasoning-support)
  - [Common Issues](#common-issues)
  - [Supported Models](#supported-models)
  - [Testing](#testing)
  - [Learn More](#learn-more)
  - [License](#license)

```typescript
import { ollama } from 'ai-sdk-ollama';
import { generateText } from 'ai';

// Standard AI SDK parameters work everywhere
const { text } = await generateText({
  model: ollama('llama3.2'),
  prompt: 'Write a haiku about coding',
  temperature: 0.8,
  maxOutputTokens: 100,
});

// Plus access to Ollama's advanced features
const { text: advancedText } = await generateText({
  model: ollama('llama3.2', {
    options: {
      mirostat: 2, // Advanced sampling algorithm
      repeat_penalty: 1.1, // Fine-tune repetition
      num_ctx: 8192, // Larger context window
    },
  }),
  prompt: 'Write a haiku about coding',
  temperature: 0.8, // Standard parameters still work
});
```

## Prerequisites

- Node.js 22+
- [Ollama](https://ollama.com) installed locally or running on a remote server
- AI SDK v5+ (`ai` package)
- TypeScript 5.9+ (for TypeScript users)

```bash
# Install Ollama from ollama.com
ollama serve

# Pull a model
ollama pull llama3.2
```

## Browser Support

See the [browser example](../../examples/browser/).

This provider works in both Node.js and browser environments. The library automatically selects the correct Ollama client based on the environment.

### Browser Usage

The same API works in browsers with automatic environment detection:

```typescript
import { ollama } from 'ai-sdk-ollama'; // Automatically uses browser version
import { generateText } from 'ai';

const { text } = await generateText({
  model: ollama('llama3.2'),
  prompt: 'Write a haiku about coding',
});
```

### Explicit Browser Import

You can also explicitly import the browser version:

```typescript
import { ollama } from 'ai-sdk-ollama/browser';
```

### CORS Configuration

For browser usage, you have several options to handle CORS:

```bash
# Option 1: Use a proxy (recommended for development)
# Configure your bundler (Vite, Webpack, etc.) to proxy /api/* to Ollama
# See browser example for Vite proxy configuration

# Option 2: Allow all origins (development only)
OLLAMA_ORIGINS=* ollama serve

# Option 3: Allow specific origins
OLLAMA_ORIGINS="http://localhost:3000,https://myapp.com" ollama serve
```

**Recommended**: Use a development proxy (like Vite proxy) to avoid CORS issues entirely. See the browser example for a complete working setup.

## More Examples

### Cross Provider Compatibility

Write code that works with any AI SDK provider:

```typescript
// This exact code works with OpenAI, Anthropic, or Ollama
const { text } = await generateText({
  model: ollama('llama3.2'), // or openai('gpt-4') or anthropic('claude-3')
  prompt: 'Write a haiku',
  temperature: 0.8,
  maxOutputTokens: 100,
  topP: 0.9,
});
```

### Native Ollama Power

Access Ollama's advanced features without losing portability:

```typescript
const { text } = await generateText({
  model: ollama('llama3.2', {
    options: {
      mirostat: 2, // Advanced sampling algorithm
      repeat_penalty: 1.1, // Repetition control
      num_ctx: 8192, // Context window size
    },
  }),
  prompt: 'Write a haiku',
  temperature: 0.8, // Standard parameters still work
});
```

> **Parameter Precedence**: When both AI SDK parameters and Ollama options are specified, **Ollama options take precedence**. For example, if you set `temperature: 0.5` in Ollama options and `temperature: 0.8` in the `generateText` call, the final value will be `0.5`. This allows you to use standard AI SDK parameters for portability while having fine-grained control with Ollama-specific options when needed.

### Enhanced Tool Calling Wrappers

For maximum tool calling reliability, use our enhanced wrapper functions that guarantee complete responses:

```typescript
import { ollama, generateText, streamText } from 'ai-sdk-ollama';
import { tool } from 'ai';
import { z } from 'zod';

// Enhanced generateText with automatic response synthesis
const result = await generateText({
  model: ollama('llama3.2'),
  prompt: 'What is 15 + 27? Use the math tool to calculate it.',
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

console.log(result.text); // "15 + 27 equals 42. Using the math tool, I calculated..."
```

### Combining Tools with Structured Output

The `enableToolsWithStructuredOutput` option allows you to use both tool calling and structured output together:

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

**When to Use Enhanced Wrappers:**

- **Critical tool calling scenarios** where you need guaranteed text responses
- **Production applications** that can't handle empty responses after tool execution
- **Complex multi-step tool interactions** requiring reliable synthesis

**Standard vs Enhanced Comparison:**

| Function                   | Standard `generateText`   | Enhanced `generateText`              |
| -------------------------- | ------------------------- | ------------------------------------ |
| **Simple prompts**         | ✅ Perfect                | ✅ Works (slight overhead)           |
| **Tool calling**           | ⚠️ May return empty text  | ✅ **Guarantees complete responses** |
| **Complete responses**     | ❌ Manual handling needed | ✅ **Automatic completion**          |
| **Production reliability** | ⚠️ Unpredictable          | ✅ **Reliable**                      |

### Simple and Predictable

The provider works the same way with any model - just try the features you need:

```typescript
// No capability checking required - just use any model
const { text } = await generateText({
  model: ollama('any-model'),
  prompt: 'What is the weather?',
  tools: {
    /* ... */
  }, // If the model doesn't support tools, you'll get a clear error
});

// The provider is simple and predictable
// - Try any feature with any model
// - Get clear error messages if something doesn't work
// - No hidden complexity or capability detection
```

## Advanced Features

### Custom Ollama Instance

You can create a custom Ollama provider instance with specific configuration:

```typescript
import { createOllama } from 'ai-sdk-ollama';

const ollama = createOllama({
  baseURL: 'http://my-ollama-server:11434',
  headers: {
    'Custom-Header': 'value',
  },
});

const { text } = await generateText({
  model: ollama('llama3.2'),
  prompt: 'Hello!',
});
```

### Using Existing Ollama Client

You can also pass an existing Ollama client instance to reuse your configuration:

```typescript
import { Ollama } from 'ollama';
import { createOllama } from 'ai-sdk-ollama';

// Create your existing Ollama client
const existingClient = new Ollama({
  host: 'http://my-ollama-server:11434',
  // Add any custom configuration
});

// Use it with the AI SDK provider
const ollamaSdk = createOllama({ client: existingClient });

// Use both clients as needed
await ollamaRaw.list(); // Direct Ollama operations
const { text } = await generateText({
  model: ollamaSdk('llama3.2'),
  prompt: 'Hello!',
});
```

### Structured Output

```typescript
import { generateObject } from 'ai';
import { z } from 'zod';

// Auto-detection: structuredOutputs is automatically enabled for object generation
const { object } = await generateObject({
  model: ollama('llama3.2'), // No need to set structuredOutputs: true
  schema: z.object({
    name: z.string(),
    age: z.number(),
    interests: z.array(z.string()),
  }),
  prompt: 'Generate a random person profile',
});

console.log(object);
// { name: "Alice", age: 28, interests: ["reading", "hiking"] }

// Explicit setting still works
const { object: explicitObject } = await generateObject({
  model: ollama('llama3.2', { structuredOutputs: true }), // Explicit
  schema: z.object({
    name: z.string(),
    age: z.number(),
  }),
  prompt: 'Generate a person',
});
```

### Auto-Detection of Structured Outputs

The provider automatically detects when structured outputs are needed:

- **Object Generation**: `generateObject` and `streamObject` automatically enable `structuredOutputs: true`
- **Text Generation**: `generateText` and `streamText` require explicit `structuredOutputs: true` for JSON output
- **Backward Compatibility**: Explicit settings are respected, with warnings when overridden
- **No Breaking Changes**: Existing code continues to work as expected

```typescript
// This works without explicit structuredOutputs: true
const { object } = await generateObject({
  model: ollama('llama3.2'),
  schema: z.object({ name: z.string() }),
  prompt: 'Generate a name',
});

// This still requires explicit setting for JSON output
const { text } = await generateText({
  model: ollama('llama3.2', { structuredOutputs: true }),
  prompt: 'Generate JSON with a message field',
});
```

### Automatic JSON Repair

> **🔧 Enhanced Reliability**: Built-in JSON repair automatically fixes malformed LLM outputs for object generation.

The provider includes automatic JSON repair that handles 14+ types of common JSON issues from LLM outputs:

```typescript
import { generateObject } from 'ai';
import { z } from 'zod';

// JSON repair is enabled by default for all object generation
const { object } = await generateObject({
  model: ollama('llama3.2'),
  schema: z.object({
    name: z.string(),
    email: z.string().email(),
    age: z.number(),
  }),
  prompt: 'Generate a person profile',
  // reliableObjectGeneration: true is the default
});

// Automatically handles:
// ✅ Trailing commas: {"name": "John",}
// ✅ Single quotes: {'name': 'John'}
// ✅ Unquoted keys: {name: "John"}
// ✅ Python constants: {active: True, value: None}
// ✅ Comments: {"name": "John" // comment}
// ✅ URLs in strings: {"url": "https://example.com" // comment}
// ✅ Escaped quotes: {"text": "It's // fine"}
// ✅ JSONP wrappers: callback({"name": "John"})
// ✅ Markdown code blocks: ```json\n{...}\n```
// ✅ Incomplete objects/arrays
// ✅ Smart quotes and special characters
// ✅ And more...
```

**Control Options:**

```typescript
// Disable all reliability features (not recommended)
const { object } = await generateObject({
  model: ollama('llama3.2', {
    reliableObjectGeneration: false, // Everything off
  }),
  schema: z.object({ message: z.string() }),
  prompt: 'Generate a message',
});

// Fine-grained control: disable only repair, keep retries
const { object: withRetries } = await generateObject({
  model: ollama('llama3.2', {
    reliableObjectGeneration: true,
    objectGenerationOptions: {
      enableTextRepair: false, // Disable repair only
      maxRetries: 3, // But keep retries
    },
  }),
  schema: z.object({ message: z.string() }),
  prompt: 'Generate a message',
});

// Custom repair function (advanced)
const { object: custom } = await generateObject({
  model: ollama('llama3.2', {
    objectGenerationOptions: {
      repairText: async ({ text, error }) => {
        // Your custom repair logic
        return text.replace(/,(\s*[}\]])/g, '$1');
      },
    },
  }),
  schema: z.object({ message: z.string() }),
  prompt: 'Generate a message',
});
```

### Reasoning Support

Some models like DeepSeek-R1 support reasoning (chain-of-thought) output. Enable this feature to see the model's thinking process:

```typescript
// Enable reasoning for models that support it (e.g., deepseek-r1:7b)
const model = ollama('deepseek-r1:7b', { reasoning: true });

// Generate text with reasoning
const { text } = await generateText({
  model,
  prompt:
    'Solve: If I have 3 boxes, each with 4 smaller boxes, and each smaller box has 5 items, how many items total?',
});

console.log('Answer:', text);
// DeepSeek-R1 includes reasoning in the output with <think> tags:
// <think>
// First, I'll calculate the number of smaller boxes: 3 × 4 = 12
// Then, the total items: 12 × 5 = 60
// </think>
// You have 60 items in total.

// Compare with reasoning disabled
const modelNoReasoning = ollama('deepseek-r1:7b', { reasoning: false });
const { text: noReasoningText } = await generateText({
  model: modelNoReasoning,
  prompt: 'Calculate 3 × 4 × 5',
});
// Output: 60 (without showing the thinking process)
```

**Recommended Reasoning Models**:

- `deepseek-r1:7b` - Balanced performance and reasoning capability (5GB)
- `deepseek-r1:1.5b` - Lightweight option (2.5GB)
- `deepseek-r1:8b` - Llama-based distilled version (5.5GB)

Install with: `ollama pull deepseek-r1:7b`

**Note**: The reasoning feature is model-dependent. Models without reasoning support will work normally without showing thinking process.

## Common Issues

- **Make sure Ollama is running** - Run `ollama serve` before using the provider
- **Pull models first** - Use `ollama pull model-name` before generating text
- **Model compatibility errors** - The provider will throw errors if you try to use unsupported features (e.g., tools with non-compatible models)
- **Network issues** - Verify Ollama is accessible at the configured URL
- **TypeScript support** - Full type safety with TypeScript 5.9+
- **AI SDK v5+ compatibility** - Built for the latest AI SDK specification

## Supported Models

Works with any model in your Ollama installation:

- **Chat**: `llama3.2`, `mistral`, `phi4-mini`, `qwen2.5`, `codellama`, `gpt-oss:20b`
- **Vision**: `llava`, `bakllava`, `llama3.2-vision`, `minicpm-v`
- **Embeddings**: `nomic-embed-text`, `all-minilm`, `mxbai-embed-large`
- **Reasoning**: `deepseek-r1:7b`, `deepseek-r1:1.5b`, `deepseek-r1:8b`
- **Cloud Models** (for web search): `qwen3-coder:480b-cloud`, `gpt-oss:120b-cloud`

## Testing

The project includes unit and integration tests:

```bash
# Run unit tests only (fast, no external dependencies)
npm test

# Run all tests (unit + integration)
npm run test:all

# Run integration tests only (requires Ollama running)
npm run test:integration
```

> **Note**: Integration tests may occasionally fail due to the non-deterministic nature of AI model outputs. This is expected behavior - the tests use loose assertions to account for LLM output variability. Some tests may also skip if required models aren't available locally.

For detailed testing information, see [Integration Tests Documentation](./src/integration-tests/README.md).

## Learn More

📚 **[Examples Directory](../../examples/)** - Comprehensive usage patterns with real working code

🚀 **[Quick Start Guide](../../examples/node/src/basic-chat.ts)** - Get running in 2 minutes

⚙️ **[Dual Parameters Demo](../../examples/node/src/dual-parameter-example.ts)** - See the key feature in action

🔧 **[Tool Calling Guide](../../examples/node/src/simple-tool-test.ts)** - Function calling with Ollama

🖼️ **[Image Processing Guide](../../examples/node/src/image-handling-example.ts)** - Vision models with LLaVA

📡 **[Streaming Examples](../../examples/node/src/streaming-simple-test.ts)** - Real-time responses

🌐 **[Web Search Tools](../../examples/node/src/web-search-example.ts)** - Web search and fetch capabilities

## License

MIT © [Jag Reehal](https://jagreehal.com)

See [LICENSE](./LICENSE) for details.
