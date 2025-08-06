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
   ```

## Running Examples

```bash
# Install dependencies
pnpm install

# Run any example
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
