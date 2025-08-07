# AI SDK Ollama Provider

[![npm version](https://badge.fury.io/js/ai-sdk-ollama.svg)](https://badge.fury.io/js/ai-sdk-ollama)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9+-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-22+-green.svg)](https://nodejs.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A Vercel AI SDK v5+ provider for Ollama built on the official `ollama` package. Type safe, future proof, with cross provider compatibility and native Ollama features.

## Contents

- [AI SDK Ollama Provider](#ai-sdk-ollama-provider)
  - [Contents](#contents)
  - [Prerequisites](#prerequisites)
  - [Quick Start](#quick-start)
    - [Installation](#installation)
    - [Basic Usage](#basic-usage)
  - [Key Features](#key-features)
    - [Cross Provider Compatibility](#cross-provider-compatibility)
    - [Native Ollama Power](#native-ollama-power)
    - [Tool Calling Support](#tool-calling-support)
    - [Simple and Predictable](#simple-and-predictable)
  - [Advanced Features](#advanced-features)
    - [Custom Ollama Instance](#custom-ollama-instance)
    - [Structured Output](#structured-output)
    - [Auto-Detection of Structured Outputs](#auto-detection-of-structured-outputs)
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

## Quick Start

### Installation

```bash
npm install ai-sdk-ollama ai@^5.0.0
```

Ensure you have Ollama running locally:

```bash
# Install Ollama from ollama.com
ollama serve

# Pull a model
ollama pull llama3.2
```

### Basic Usage

```typescript
import { ollama } from 'ai-sdk-ollama';
import { generateText, streamText, embed } from 'ai';

// Simple text generation
const { text } = await generateText({
  model: ollama('llama3.2'),
  prompt: 'What is the capital of France?',
});

console.log(text); // "The capital of France is Paris."

// Streaming responses
const { textStream } = await streamText({
  model: ollama('llama3.2'),
  prompt: 'Tell me a story about a robot',
});

for await (const chunk of textStream) {
  process.stdout.write(chunk);
}

// Embeddings
const { embedding } = await embed({
  model: ollama.embedding('nomic-embed-text'),
  value: 'Hello world',
});

console.log(embedding.length); // 768 dimensions
```

## Key Features

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

### Tool Calling Support

Ollama supports tool calling with compatible models.

```typescript
import { z } from 'zod';

const { text, toolCalls } = await generateText({
  model: ollama('llama3.2'),
  prompt: 'What is the weather in San Francisco?',
  tools: {
    getWeather: {
      description: 'Get current weather for a location',
      inputSchema: z.object({
        location: z.string().describe('City name'),
        unit: z.enum(['celsius', 'fahrenheit']).optional(),
      }),
      execute: async ({ location, unit = 'celsius' }) => {
        // Your actual weather API call here
        return { temp: 18, unit, condition: 'sunny' };
      },
    },
  },
});
```

> **Note on Tool Parameters**: Due to Zod version compatibility issues, tool schemas may not always convert properly. When this happens, Ollama may use different parameter names than defined in your schema. It's recommended to handle parameter variations in your tool's execute function (e.g., checking for both `location` and `city`).

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

## Common Issues

- **Make sure Ollama is running** - Run `ollama serve` before using the provider
- **Pull models first** - Use `ollama pull model-name` before generating text
- **Model compatibility errors** - The provider will throw errors if you try to use unsupported features (e.g., tools with non-compatible models)
- **Network issues** - Verify Ollama is accessible at the configured URL
- **TypeScript support** - Full type safety with TypeScript 5.9+
- **AI SDK v5+ compatibility** - Built for the latest AI SDK specification

## Supported Models

Works with any model in your Ollama installation:

- **Chat**: `llama3.2`, `mistral`, `phi4-mini`, `qwen2.5`, `codellama`
- **Vision**: `llava`, `bakllava`, `llama3.2-vision`, `minicpm-v`
- **Embeddings**: `nomic-embed-text`, `all-minilm`, `mxbai-embed-large`

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

📚 **[Examples Directory](./examples/)** - Comprehensive usage patterns with real working code

🚀 **[Quick Start Guide](./examples/basic-chat.ts)** - Get running in 2 minutes

⚙️ **[Dual Parameters Demo](./examples/dual-parameter-example.ts)** - See the key feature in action

🔧 **[Tool Calling Guide](./examples/tool-calling-example.ts)** - Function calling with Ollama

🖼️ **[Image Processing Guide](./examples/image-handling-example.ts)** - Vision models with LLaVA

📡 **[Streaming Examples](./examples/streaming-simple-test.ts)** - Real-time responses

## License

MIT © [Jag Reehal](https://jagreehal.com)

See [LICENSE](./LICENSE) for details.
