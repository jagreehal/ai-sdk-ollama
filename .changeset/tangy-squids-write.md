---
'ai-sdk-ollama': minor
---

# Enhanced generateText with Automatic Response Synthesis

## What's New

- **Automatic Response Synthesis**: `generateText` now automatically detects when tools execute but return empty responses and synthesizes a comprehensive response using the tool results
- **Prototype Preservation**: Enhanced responses preserve all original AI SDK methods and getters using proper prototype inheritance
- **Experimental Output Support**: New opt-in `enableToolsWithStructuredOutput` feature allows combining tool calling with `experimental_output` (structured output)
- **Type Safety**: Full TypeScript support with proper generic type inference for `experimental_output` schemas

## Breaking Changes

None - this is a backward-compatible enhancement.

## Migration Guide

No migration required. The enhanced behavior is enabled by default and preserves all existing functionality.

### New Features

#### Automatic Synthesis (Default)
```typescript
import { generateText, ollama } from 'ai-sdk-ollama';

// Tools execute but return empty response? No problem!
const result = await generateText({
  model: ollama('llama3.2'),
  prompt: 'Calculate 25 * 1.08',
  tools: { math: mathTool }
});

// Result now includes synthesized text explaining the calculation
console.log(result.text); // "The calculation 25 * 1.08 equals 27..."
```

#### Experimental Output with Tools (Opt-in)
```typescript
import { z } from 'zod';

const result = await generateText({
  model: ollama('llama3.2'),
  prompt: 'Get weather and format as JSON',
  tools: { weather: weatherTool },
  toolChoice: 'required',
  experimental_output: z.object({
    location: z.string(),
    temperature: z.number(),
    condition: z.string()
  }),
  enhancedOptions: {
    enableToolsWithStructuredOutput: true // Opt-in feature
  }
});

// Combines tool execution with structured output
console.log(result.experimental_output); // Properly typed schema
```

## Technical Details

- Uses `Object.create()` and `Object.getOwnPropertyDescriptors()` to preserve prototype methods
- Synthesis attempts up to 2 times with configurable prompts
- Maintains full compatibility with AI SDK's type system
- Enhanced responses include combined token usage from both tool execution and synthesis phases
