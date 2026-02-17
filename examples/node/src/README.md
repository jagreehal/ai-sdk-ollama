# Ollama AI SDK Examples

This directory contains comprehensive examples demonstrating the enhanced Ollama provider with reliability features.

## Available Demos

### Core Function Demos

1. **`basic-chat.ts`** - Basic Chat Example
   - Simple chat example using the standard AI SDK with enhanced Ollama provider
   - Run: `npx tsx src/basic-chat.ts`

2. **`embedding-example.ts`** - Embedding Example
   - Demonstrates text embedding with Ollama
   - Run: `npx tsx src/embedding-example.ts`

3. **`streaming-comprehensive.ts`** - Streaming Examples
   - Comprehensive streaming examples with enhanced Ollama provider
   - Run: `npx tsx src/streaming-comprehensive.ts`

4. **`streaming-simple-test.ts`** - Simple Streaming Test
   - Basic streaming functionality test
   - Run: `npx tsx src/streaming-simple-test.ts`

5. **`minimal-stream-test.ts`** - Minimal Streaming Test
   - Minimal streaming example
   - Run: `npx tsx src/minimal-stream-test.ts`

### Tool Calling Examples

6. **`test-tool-calling.ts`** - Tool Calling Test
   - Basic tool calling with enhanced Ollama provider
   - Run: `npx tsx src/test-tool-calling.ts`

7. **`test-tool-calling-models.ts`** - Tool Calling Models Test
   - Tests tool calling with different models
   - Run: `npx tsx src/test-tool-calling-models.ts`

8. **`simple-tool-test.ts`** - Simple Tool Test
   - Simple tool calling example
   - Run: `npx tsx src/simple-tool-test.ts`

9. **`corrected-tool-test.ts`** - Corrected Tool Test
   - Tool calling with error correction
   - Run: `npx tsx src/corrected-tool-test.ts`

10. **`tool-json-repair-example.ts`** - Tool call JSON repair
    - Demonstrates `parseToolArguments` (jsonrepair for tool-argument strings)
    - Run: `npx tsx src/tool-json-repair-example.ts`

11. **`tool-result-image-example.ts`** - Tool result with image content
    - Tool returns content with text and image-data; provider sends images in tool results
    - Run: `npx tsx src/tool-result-image-example.ts`

### Advanced Examples

12. **`mcp-tools-example.ts`** - MCP Tools Example
    - Model Context Protocol tools example
    - Run: `npx tsx src/mcp-tools-example.ts`

13. **`image-handling-example.ts`** - Image Handling Example
    - Image processing with Ollama
    - Run: `npx tsx src/image-handling-example.ts`

14. **`reasoning-example.ts`** - Reasoning Example
    - Advanced reasoning capabilities
    - Run: `npx tsx src/reasoning-example.ts`

15. **`reasoning-example-simple.ts`** - Simple Reasoning Example
    - Basic reasoning example
    - Run: `npx tsx src/reasoning-example-simple.ts`

16. **`quoted-json-example.ts`** - Quoted JSON Fix Example
    - Demonstrates the fix for JSON wrapped in quotes or markdown
    - Shows how string values are preserved during JSON repair
    - Run: `npx tsx src/quoted-json-example.ts`

## Key Features Demonstrated

### Enhanced Ollama Provider Features
- **Improved Reliability**: Better error handling and retry logic
- **Enhanced Tool Calling**: More reliable tool calling with Ollama models
- **Better Response Synthesis**: Improved response generation after tool calls
- **Parameter Normalization**: Handles different parameter names and formats
- **Stop Conditions**: Enhanced stop conditions for better completion

### Standard AI SDK Functions
All examples use the standard AI SDK functions with the enhanced Ollama provider:
- `generateText` - Text generation with tools
- `generateText` with `Output.object()` - Structured object generation
- `streamText` - Real-time text streaming
- `streamText` with `Output.object()` - Real-time object streaming
- `embed` - Text embeddings

## Usage Patterns

### For Text Generation with Tools
```typescript
import { ollama } from 'ai-sdk-ollama';
import { generateText, tool } from 'ai';
import { z } from 'zod';

const myTool = tool({
  description: 'Your tool description',
  inputSchema: z.object({
    // your schema
  }),
  execute: async ({ /* parameters */ }) => {
    // your tool logic
  },
});

const result = await generateText({
  model: ollama('llama3.2'),
  prompt: 'Your prompt here',
  tools: { myTool },
});
```

### For Object Generation
```typescript
import { ollama } from 'ai-sdk-ollama';
import { generateText, Output } from 'ai';
import { z } from 'zod';

const schema = z.object({
  // your schema
});

const result = await generateText({
  model: ollama('llama3.2'),
  prompt: 'Your prompt here',
  output: Output.object({ schema }),
});
```

### For Text Streaming
```typescript
import { ollama } from 'ai-sdk-ollama';
import { streamText } from 'ai';

const result = await streamText({
  model: ollama('llama3.2'),
  prompt: 'Your prompt here',
});

for await (const chunk of result.textStream) {
  process.stdout.write(chunk);
}
```

### For Object Streaming
```typescript
import { ollama } from 'ai-sdk-ollama';
import { streamObject } from 'ai';
import { z } from 'zod';

const schema = z.object({
  // your schema
});

const result = await streamObject({
  model: ollama('llama3.2'),
  prompt: 'Your prompt here',
  schema,
});

for await (const chunk of result.partialObjectStream) {
  console.log(JSON.stringify(chunk, null, 2));
}
```

## Prerequisites

1. **Ollama Installation**: Make sure Ollama is installed and running
2. **Model Availability**: Ensure you have the required models (e.g., `llama3.2`)
3. **Dependencies**: Install required packages:
   ```bash
   npm install ai-sdk-ollama ai zod
   ```

## Running the Examples

1. Navigate to the examples directory:
   ```bash
   cd examples/node
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Run any demo:
   ```bash
   npx tsx src/[demo-name].ts
   ```

## Troubleshooting

- **Model Not Found**: Ensure the specified model is available in Ollama
- **Connection Issues**: Check that Ollama is running (`ollama serve`)
- **Type Errors**: Make sure all dependencies are properly installed
- **Performance Issues**: Consider using smaller models for testing

## Best Practices

1. **Use Enhanced Provider**: Always use `ollama` from `ai-sdk-ollama` for better reliability
2. **Handle Errors**: Always wrap function calls in try-catch blocks
3. **Use Schemas**: Define proper schemas for object generation
4. **Test Thoroughly**: Run examples multiple times to verify consistency
5. **Tool Calling**: Use tools with `generateText` and `streamText` for enhanced reliability

## Contributing

When adding new examples:
1. Follow the existing naming convention
2. Include comprehensive error handling
3. Add clear comments and documentation
4. Test with multiple models if possible
5. Update this README with new examples