# AI SDK v5+ Ollama Provider Examples

This directory contains examples demonstrating various features of the ai-sdk-ollama provider for AI SDK v5+.

## Prerequisites

1. Install Ollama from [ollama.com](https://ollama.com)
2. Start Ollama: `ollama serve`
3. Pull required models:
   ```bash
   ollama pull llama3.2
   ollama pull phi4-mini
   ollama pull qwen2.5-coder
   ollama pull nomic-embed-text
   # For reasoning examples:
   ollama pull deepseek-r1:7b
   # For gpt-oss:20b
   ollama pull gpt-oss:20b
   ```

## Running Examples

```bash
# From repo root
pnpm install

# Run any example directly with tsx
npx tsx examples/[example-name].ts
```

## 🎯 **Essential Examples (Start Here)**

### **basic-chat.ts** - Quick Start

This example demonstrates the essential features to get you started quickly

- Basic text generation
- Streaming responses
- Embeddings generation
- Custom model settings

```bash
npx tsx examples/basic-chat.ts
```

### **dual-parameter-example.ts** - Key Feature Demo

This example explains the unique dual parameter architecture

- AI SDK v5+ standard parameters (cross-provider compatible)
- Native Ollama options (advanced control)
- Hybrid approach combining both
- Future compatibility demonstration

```bash
npx tsx examples/dual-parameter-example.ts
```

## 🔧 **Advanced Features**

### **tool-calling-example.ts** - Tool Integration

This example demonstrates tool calling with Ollama models

- Single tool usage (weather API)
- Multiple tools in one request
- Tool choice control (auto, required, none)
- Type-safe tool definitions with Zod schemas

```bash
npx tsx examples/tool-calling-example.ts
```

### **test-enhanced-structured-output.ts** - Advanced Tool + Structured Output

This example demonstrates the `enableToolsWithStructuredOutput` feature

- Standard behavior: tools bypassed when using experimental_output
- Enhanced behavior: tools called AND structured output generated
- Comparison between standard and enhanced modes
- Real data from tools used in structured output

```bash
npx tsx examples/test-enhanced-structured-output.ts
```

### **image-handling-example.ts** - Image Processing

This example demonstrates image handling capabilities with AI SDK v5 format

- Images from URLs
- Base64 encoded images
- Multiple images in one prompt
- Image-only prompts
- Streaming with images
- Mixed content types (text + image + text)

```bash
npx tsx examples/image-handling-example.ts
```

### **image-generation-example.ts** - Image Generation (Experimental)

This example uses the AI SDK's `generateImage()` with the Ollama provider's image model (`ollama.imageModel()`).

- Uses `generateImage({ model: ollama.imageModel('x/z-image-turbo'), prompt })` (AI SDK way)
- Optional `size`, `aspectRatio`, `seed`, `providerOptions.ollama` (e.g. steps, negative_prompt)
- Saves images to `output/`

**Prerequisites**: `ollama pull x/z-image-turbo`. Image generation is experimental (macOS first).

```bash
npx tsx src/image-generation-example.ts
npx tsx src/image-generation-example.ts "Your prompt here"
```

### **streaming-simple-test.ts** - Streaming Basics

This example covers streaming fundamentals for real-time applications

- Basic text streaming
- Real-time display techniques
- Multi-model streaming
- Performance optimization

```bash
npx tsx examples/streaming-simple-test.ts
```

### **streaming-comprehensive.ts** - Advanced Streaming

This example shows comprehensive streaming with all available features

- Streaming with tool calls
- Event handling and metadata
- Abort control
- Object streaming (JSON)

```bash
npx tsx examples/streaming-comprehensive.ts
```

### **reasoning-example.ts** - Reasoning Support (DeepSeek-R1)

This example demonstrates reasoning (chain-of-thought) capabilities with DeepSeek-R1 models

- Mathematical reasoning with verification
- Logic puzzles with step-by-step deduction
- Code verification and analysis
- Comparison with reasoning disabled
- Shows how DeepSeek-R1 includes `<think>` tags in output

**Required model**: Install with `ollama pull deepseek-r1:7b`

```bash
npx tsx examples/reasoning-example.ts
```

### **reasoning-example-simple.ts** - Simple Reasoning Demo

A simplified example focusing on the core reasoning feature

- Basic mathematical reasoning
- Clear comparison between reasoning enabled/disabled
- Minimal setup for quick testing

```bash
npx tsx examples/reasoning-example-simple.ts
```

## 🧠 **Intelligent Features**

### **model-capabilities-demo.ts** - Model Capability Detection

This example demonstrates automatic model capability detection

- Model capability detection
- Intelligent warnings and suggestions
- Graceful handling of unsupported features
- Model recommendations for different use cases

```bash
npx tsx examples/model-capabilities-demo.ts
```

## 🔍 **Specialized Examples**

### **embedding-example.ts** - Vector Embeddings

This example shows how to generate embeddings for semantic search

- Single text embedding
- Multiple embeddings with batch processing
- Dimension verification

```bash
npx tsx examples/embedding-example.ts
```

### **existing-client-example.ts** - Using Existing Ollama Client

This example demonstrates how to use an existing Ollama client instance with the AI SDK provider

- Creating an existing Ollama client with custom configuration
- Passing the client to createOllama
- Using both raw client methods and AI SDK operations
- Model listing and information retrieval

```bash
npx tsx examples/existing-client-example.ts
```

## 🌐 **Web Search Examples**

### **web-search-example.ts** - AI SDK Web Search Integration

This example demonstrates how to use Ollama's web search capabilities with the AI SDK

- Basic web search for current information
- Combining web search and web fetch
- Streaming with web search
- Error handling and fallback behavior
- Tool integration with AI SDK

**Prerequisites**: Set `OLLAMA_API_KEY` environment variable

```bash
npx tsx examples/web-search-example.ts [basic|combined|streaming|error]
```

### **simple-web-search-examples.ts** - Direct Ollama Web Search

This example provides direct implementations matching the official Ollama web search blog post patterns

- Basic web search (exact match to blog post)
- Web fetch for specific URLs
- Simple search agent pattern
- Direct Ollama JavaScript library usage

**Prerequisites**: Set `OLLAMA_API_KEY` environment variable

```bash
npx tsx examples/simple-web-search-examples.ts [basic|fetch|agent|all]
```

### **ollama-web-search-examples.ts** - Advanced Search Agent

This example demonstrates advanced search agent patterns with multi-turn interactions

- Multi-turn search agent conversations
- Tool integration with web search and fetch
- Error handling and graceful degradation
- Complex reasoning with search results

**Prerequisites**: Set `OLLAMA_API_KEY` environment variable

```bash
npx tsx examples/ollama-web-search-examples.ts [basic|agent|fetch|error|all]
```

**Note**: Web search examples require an Ollama API key. Get yours from [ollama.com/account](https://ollama.com/account)

## Key Features Demonstrated

### Dual Parameter Support

The provider supports parameters in two ways:

1. **AI SDK v5+ Standard Parameters** - For cross-provider compatibility:

   ```typescript
   generateText({
     model: ollama('llama3.2'),
     temperature: 0.8,
     maxOutputTokens: 100,
     topP: 0.9,
   });
   ```

2. **Native Ollama Options** - For advanced control:

   ```typescript
   generateText({
     model: ollama('llama3.2', {
       options: {
         mirostat: 2,
         repeat_penalty: 1.1,
       },
     }),
   });
   ```

### Future Compatibility

All Ollama options are passed directly to the official library, ensuring new features work immediately without provider updates.

## Troubleshooting

### Models Not Found

If you get a "model not found" error, pull the model first:

```bash
ollama pull [model-name]
```

### Connection Errors

Ensure Ollama is running:

```bash
ollama serve
```

### Port Conflicts

If port 11434 is in use, set a custom URL:

```typescript
import { createOllama } from '../src';

const ollama = createOllama({
  baseURL: 'http://localhost:11435',
});
```

## Additional Resources

- [Ollama Documentation](https://github.com/ollama/ollama)
- [Vercel AI SDK Documentation](https://sdk.vercel.ai/docs)
- [Main README](../README.md)
