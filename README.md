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
    - [Smart Model Intelligence](#smart-model-intelligence)
  - [Advanced Features](#advanced-features)
    - [Custom Ollama Instance](#custom-ollama-instance)
    - [Structured Output](#structured-output)
  - [Common Issues](#common-issues)
  - [Supported Models](#supported-models)
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

### Tool Calling Support

Ollama supports tool calling with compatible models:

```typescript
import { z } from 'zod';

const { text, toolCalls } = await generateText({
  model: ollama('llama3.2'),
  prompt: 'What is the weather in San Francisco?',
  tools: {
    getWeather: {
      description: 'Get current weather for a location',
      parameters: z.object({
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

### Smart Model Intelligence

The provider automatically detects model capabilities and provides helpful suggestions:

```typescript
// The provider will automatically warn you if a model doesn't support tools
const { text } = await generateText({
  model: ollama('llama3'), // Older model without tool support
  prompt: 'What is the weather?',
  tools: {
    /* ... */
  }, // This will throw a helpful error with suggestions
});

// Get model recommendations for specific features
import { suggestModelsForFeatures } from 'ai-sdk-ollama';

const suggestions = suggestModelsForFeatures({
  toolCalling: true,
  performance: 'fast',
});
// Returns: [{ modelId: 'llama3.2', reason: 'Excellent tool calling...' }]
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

const { object } = await generateObject({
  model: ollama('llama3.2', { structuredOutputs: true }),
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

## Common Issues

- **Make sure Ollama is running** - Run `ollama serve` before using the provider
- **Pull models first** - Use `ollama pull model-name` before generating text
- **Model compatibility errors** - The provider will throw errors if you try to use unsupported features (e.g., tools with non-compatible models)
- **Network issues** - Verify Ollama is accessible at the configured URL
- **TypeScript support** - Full type safety with TypeScript 5.9+
- **AI SDK v5+ compatibility** - Built for the latest AI SDK specification

## Supported Models

Works with any model in your Ollama installation:

- **Chat**: `llama3.2`, `llama3.1`, `mistral`, `phi4-mini`, `qwen2.5`, `codellama`
- **Vision**: `llama3.2-vision`, `llava`, `minicpm-v`
- **Embeddings**: `nomic-embed-text`, `all-minilm`, `mxbai-embed-large`

## Learn More

📚 **[Examples Directory](./examples/)** - Comprehensive usage patterns with real working code

🚀 **[Quick Start Guide](./examples/basic-chat.ts)** - Get running in 2 minutes

⚙️ **[Dual Parameters Demo](./examples/dual-parameter-example.ts)** - See the key feature in action

🔧 **[Tool Calling Guide](./examples/tool-calling-example.ts)** - Function calling with Ollama

📡 **[Streaming Examples](./examples/streaming-simple-test.ts)** - Real-time responses

## License

MIT © [Jag Reehal](https://jagreehal.com)
