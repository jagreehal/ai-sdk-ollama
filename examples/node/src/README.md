# Ollama AI SDK Examples

This directory contains comprehensive examples demonstrating the enhanced Ollama functions with reliability features.

## Available Demos

### Core Function Demos

1. **`generate-text-ollama-demo.ts`** - Tool Calling Demo
   - Demonstrates `generateTextOllama` with tool calling reliability
   - Shows comparison between reliable and unreliable tool calling
   - Tests parameter normalization and retry logic
   - Run: `npx tsx src/generate-text-ollama-demo.ts`

2. **`generate-object-ollama-demo.ts`** - Object Generation Demo
   - Demonstrates `generateObjectOllama` for structured object generation
   - Shows weather, person, and product object generation
   - Tests reliability features and error recovery
   - Run: `npx tsx src/generate-object-ollama-demo.ts`

3. **`stream-text-ollama-demo.ts`** - Text Streaming Demo
   - Demonstrates `streamTextOllama` for real-time text streaming
   - Shows streaming with tool calls and multiple tools
   - Tests reliability comparison and long-form content
   - Run: `npx tsx src/stream-text-ollama-demo.ts`

4. **`stream-object-ollama-demo.ts`** - Object Streaming Demo
   - Demonstrates `streamObjectOllama` for real-time object streaming
   - Shows complex objects with arrays and records
   - Tests error handling and recovery
   - Run: `npx tsx src/stream-object-ollama-demo.ts`

5. **`generate-all-ollama-demo.ts`** - All Functions Demo
   - Demonstrates all four Ollama functions in one comprehensive example
   - Shows function comparison and use case recommendations
   - Tests performance and reliability features
   - Run: `npx tsx src/generate-all-ollama-demo.ts`

### Additional Examples

6. **`basic-chat.ts`** - Basic Chat Example
   - Simple chat example using the standard AI SDK
   - Run: `npx tsx src/basic-chat.ts`

7. **`embedding-example.ts`** - Embedding Example
   - Demonstrates text embedding with Ollama
   - Run: `npx tsx src/embedding-example.ts`

8. **`streaming-comprehensive.ts`** - Streaming Examples
   - Comprehensive streaming examples
   - Run: `npx tsx src/streaming-comprehensive.ts`

## Key Features Demonstrated

### Reliability Features
- **Parameter Normalization**: Handles different parameter names and formats
- **Retry Logic**: Automatic retries with exponential backoff
- **Error Recovery**: Graceful handling of malformed responses
- **Stop Conditions**: Enhanced stop conditions for better completion
- **Response Synthesis**: Ensures complete responses even after tool calls

### Function-Specific Features

#### generateTextOllama
- Enhanced tool calling reliability
- Better parameter handling
- Improved response synthesis
- Automatic retry logic

#### generateObjectOllama
- Schema validation and recovery
- Type mismatch fixing
- Fallback value generation
- Object reliability features

#### streamTextOllama
- Real-time text streaming
- Progressive response delivery
- Tool calling support
- Enhanced stop conditions

#### streamObjectOllama
- Real-time object streaming
- Progressive object building
- Schema validation during streaming
- Error handling for streaming

## Usage Patterns

### For Text Generation
```typescript
import { generateTextOllama } from 'ai-sdk-ollama';

const result = await generateTextOllama({
  model: ollama('llama3.2'),
  prompt: 'Your prompt here',
  tools: { /* your tools */ },
  enhancedOptions: {
    enableReliability: true,
    maxSteps: 5,
    minResponseLength: 30,
  },
});
```

### For Object Generation
```typescript
import { generateObjectOllama } from 'ai-sdk-ollama';
import { z } from 'zod';

const schema = z.object({
  // your schema
});

const result = await generateObjectOllama({
  model: ollama('llama3.2'),
  prompt: 'Your prompt here',
  schema,
  enhancedOptions: {
    enableReliability: true,
    objectReliabilityOptions: {
      maxRetries: 3,
      attemptRecovery: true,
    },
  },
});
```

### For Text Streaming
```typescript
import { streamTextOllama } from 'ai-sdk-ollama';

const result = await streamTextOllama({
  model: ollama('llama3.2'),
  prompt: 'Your prompt here',
  enhancedOptions: {
    enableReliability: true,
    maxSteps: 5,
  },
});

for await (const chunk of result.textStream) {
  process.stdout.write(chunk);
}
```

### For Object Streaming
```typescript
import { streamObjectOllama } from 'ai-sdk-ollama';

const result = await streamObjectOllama({
  model: ollama('llama3.2'),
  prompt: 'Your prompt here',
  schema,
  enhancedOptions: {
    enableReliability: true,
  },
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

1. **Always Enable Reliability**: Set `enableReliability: true` for production use
2. **Set Appropriate Limits**: Configure `maxSteps` and `minResponseLength` based on your needs
3. **Handle Errors**: Always wrap function calls in try-catch blocks
4. **Use Schemas**: Define proper schemas for object generation
5. **Test Thoroughly**: Run examples multiple times to verify consistency

## Contributing

When adding new examples:
1. Follow the existing naming convention
2. Include comprehensive error handling
3. Add clear comments and documentation
4. Test with multiple models if possible
5. Update this README with new examples
