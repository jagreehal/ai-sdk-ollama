# Integration Tests

This directory contains comprehensive integration tests for the Ollama AI SDK. These tests verify that the library works correctly with actual Ollama models running locally, covering all major AI SDK features and Ollama-specific functionality.

## Prerequisites

1. **Ollama installed and running**: Make sure you have Ollama installed and running locally
2. **Required models**: The tests expect the following models to be available:
   - `llama3.2` - For text generation, object generation, and tool calling
   - `llava` - For multimodal (image) testing
   - `nomic-embed-text` - For embedding and batch embedding tests

## Running the Tests

### Run only unit tests (CI/CD friendly)

```bash
npm test
```

### Run all tests (unit + integration)

```bash
npm run test:all
```

### Run only integration tests

```bash
npm run test:integration
```

### Run integration tests in watch mode

```bash
npm run test:integration:watch
```

### Run specific integration test

```bash
# Run only text generation tests
npx vitest run src/integration-tests/generate-text.test.ts --config vitest.integration.config.ts

# Run only embedding tests
npx vitest run src/integration-tests/embed.test.ts --config vitest.integration.config.ts
```

## Test Categories

### Core AI SDK Features

#### 1. Generate Text (`generate-text.test.ts`)

Tests basic text generation functionality:

- Basic prompt generation
- Different models
- Structured outputs
- Token limits
- Temperature settings

#### 2. Generate Object (`generate-object.test.ts`)

Tests structured object generation:

- Recipe schema generation
- Array of objects
- Nested object structures
- Usage and finish reason

#### 3. Stream Text (`stream-text.test.ts`)

Tests streaming text functionality:

- Multiple chunks
- Different models
- Token limits
- Usage and finish reason
- Temperature variations

#### 4. Stream Object (`stream-object.test.ts`)

Tests streaming object generation:

- Partial object streaming
- Progressive object building
- Complex schemas
- Usage and finish reason

### Embedding Features

#### 5. Embed (`embed.test.ts`)

Tests single embedding functionality:

- Text embeddings
- Different text lengths
- Concurrent embeddings
- Special characters
- Model variations

#### 6. Embed Many (`embed-many.test.ts`)

Tests batch embedding functionality:

- Multiple text embeddings in one call
- Cosine similarity calculations
- Embedding comparison operations
- Empty arrays handling

### Advanced AI Features

#### 7. Tool Calling (`tool-calling.test.ts`)

Tests tool calling functionality:

- Basic tool calls
- Multiple tool types
- Tool execution
- Complex schemas
- Different models

#### 8. Multi-Step (`multi-step.test.ts`)

Tests multi-step generation:

- Step-by-step text generation
- Sequential processing
- Step-by-step instructions

#### 9. JSON Schema (`json-schema.test.ts`)

Tests JSON Schema integration:

- jsonSchema() helper function
- Enum validation
- Complex schema structures
- Schema-driven object generation

#### 10. Multimodal (`multimodal.test.ts`)

Tests image and text processing:

- Text + image content in messages
- Image URL handling
- Base64 image processing
- Streaming multimodal content

#### 11. Messages (`messages.test.ts`)

Tests conversation and message handling:

- System messages and prompts
- Multi-turn conversations
- Different message roles (user/assistant/system)
- Conversation context management

#### 12. Parameter Precedence (`parameter-precedence.test.ts`)

Tests dual parameter support and precedence:

- AI SDK standard parameters for cross-provider compatibility
- Native Ollama options for advanced features
- Hybrid approach (AI SDK + Ollama options combined)
- Parameter mapping and precedence verification
- Future compatibility with unknown parameters
- Deterministic behavior with seed parameters

#### 13. Streaming Performance (`streaming-performance.test.ts`)

Tests streaming performance characteristics:

- Basic streaming performance metrics (time to first chunk, throughput)
- Real-time streaming with chunk analysis
- Performance comparison across different prompts
- Streaming efficiency with different models
- Tool call streaming performance
- Throughput benchmarking

#### 14. Streaming Metadata (`streaming-metadata.test.ts`)

Tests detailed streaming event tracking:

- Comprehensive streaming events and metadata
- Usage statistics and timing patterns
- Tool call event tracking
- Streaming consistency analysis
- Abort handling with metadata
- Concurrent streaming metadata

### System and Error Handling

#### 15. Error Handling (`error-handling.test.ts`)

Tests error scenarios and edge cases:

- Non-existent models
- Network errors
- Long prompts
- Special characters
- Concurrent requests

#### 16. Advanced Features (`advanced-features.test.ts`)

Tests advanced Ollama-specific features:

- All Ollama parameters (temperature, top_k, top_p, etc.)
- Stop sequences
- Deterministic output (seeds)
- Advanced sampling parameters
- Abort signals
- Context window configuration

#### 17. Auto-Detection (`auto-detection.test.ts`)

Tests automatic detection of structured outputs:

- Auto-enabling structuredOutputs for object generation
- Backward compatibility with explicit settings
- Warning messages for overridden settings

## Test Design Principles

1. **Loose Assertions**: Since AI model outputs are non-deterministic, tests use loose assertions like:
   - `expect(text).toBeTruthy()`
   - `expect(text.toLowerCase()).toContain('hello')`
   - `expect(text.toLowerCase()).toMatch(/pattern/)`

2. **Structure Validation**: For structured outputs, tests validate the structure rather than exact content:
   - `expect(object.name).toBeTruthy()`
   - `expect(typeof object.age).toBe('number')`
   - `expect(Array.isArray(object.colors)).toBe(true)`

3. **Usage Validation**: Tests verify that usage statistics are provided:
   - `expect(usage.inputTokens).toBeGreaterThan(0)`
   - `expect(usage.outputTokens).toBeGreaterThan(0)`

4. **Error Handling**: Tests verify that errors are properly thrown for invalid inputs:
   - Non-existent models
   - Network errors
   - Invalid parameters

## Configuration

### Test Timeouts

- **Unit tests**: 10 seconds (fast, no external dependencies)
- **Integration tests**: 120 seconds (2 minutes) to account for LLM response times
- **Sequential execution**: Integration tests run one at a time to avoid overwhelming Ollama

### Test Configs

- **Unit tests**: Use `vitest.unit.config.ts` (excludes integration directory)
- **Integration tests**: Use `vitest.integration.config.ts` (includes only integration directory)

## Environment Setup

### Required Models

Pull these models in Ollama before running tests:

```bash
ollama pull llama3.2
ollama pull llava
ollama pull nomic-embed-text
```

### Starting Ollama

Make sure Ollama is running:

```bash
ollama serve
```

## Notes

- **CI/CD**: Only unit tests run by default (`npm test`) - no Ollama required
- **Local Development**: Run integration tests locally with `npm run test:integration`
- **Model Dependencies**: Some tests may skip if required models are not available
- **Non-deterministic**: Tests use loose assertions due to LLM output variability
- **Sequential Execution**: Integration tests run sequentially to avoid rate limiting
- **Timeout Handling**: Longer timeouts account for model loading and generation time

## Coverage

The integration tests comprehensively cover:

- ✅ All AI SDK core functions (`generateText`, `streamText`, `generateObject`, `streamObject`)
- ✅ Embedding functions (`embed`, `embedMany`, `cosineSimilarity`)
- ✅ Advanced features (tool calling, multi-step, JSON schema, multimodal)
- ✅ Ollama-specific parameters and configurations
- ✅ Parameter precedence and dual parameter support
- ✅ Streaming performance and metadata tracking
- ✅ Error handling and edge cases
- ✅ Message types and conversation patterns

**Complete Examples Coverage**: All functionality demonstrated in the `/examples` directory is now covered by integration tests, ensuring 100% feature parity between examples and test coverage.
