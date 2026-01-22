---
'ai-sdk-ollama': minor
---

Added comprehensive object generation reliability features to improve the success rate and consistency of structured output generation with Ollama models.

### New Features

- **Enhanced JSON Repair**: Automatic repair of malformed JSON responses including:
  - Extraction from markdown code blocks
  - Removal of comments and trailing commas
  - Fixing smart quotes, single quotes, and unquoted keys
  - Handling Python constants (True/False/None)
  - Closing incomplete objects and arrays
  - URL preservation in strings

- **Retry Logic**: Configurable retry attempts (default: 3) for failed object generations

- **Schema Recovery**: Automatic schema validation and recovery when validation fails

- **Type Mismatch Fixing**: Automatic conversion of type mismatches (e.g., string to number) based on schema requirements

- **Fallback Values**: Optional fallback value generation when all retry attempts fail

- **New Provider Options**:
  - `reliableObjectGeneration?: boolean` - Enable/disable reliability features (default: true)
  - `objectGenerationOptions?: ObjectGenerationOptions` - Fine-grained control over reliability behavior

### Usage

The reliability features are enabled by default when using `generateObject` or `streamObject`. You can customize behavior via the new `objectGenerationOptions`:

```typescript
const result = await generateObject({
  model: ollama('llama3.2'),
  schema: mySchema,
  prompt: 'Generate user data',
  objectGenerationOptions: {
    maxRetries: 5,
    fixTypeMismatches: true,
    enableTextRepair: true,
  }
});
```

### Breaking Changes

None. This is a backward-compatible addition.
