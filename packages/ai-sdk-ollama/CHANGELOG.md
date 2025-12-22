# Changelog

## 3.0.0

### Major Changes

- 22d327f: Migrate to AI SDK v6 with full compatibility and alignment with official SDK.

  ## Breaking Changes
  - **AI SDK v6 Required**: Now requires `ai@^6.0.0` (previously `ai@^5.0.0`)
  - **Removed Custom Utilities**: Deleted custom implementations of utilities now available in official AI SDK:
    - `createAsyncIterableStream`, `createStitchableStream`, `createResolvablePromise`, `fixJson`, `parsePartialJsonAsync` removed
    - Use official AI SDK exports from `'ai'` instead: `parsePartialJson`, `simulateReadableStream`, `smoothStream`
  - **Removed Custom Middleware**: Deleted custom middleware implementations (`wrapLanguageModel`, `defaultSettingsMiddleware`, `extractReasoningMiddleware`, `simulateStreamingMiddleware`)
    - All middleware now re-exported from official AI SDK
  - **Removed Custom Agent**: Deleted custom `ToolLoopAgent` implementation
    - Use official `ToolLoopAgent` from `'ai'` package
    - `toolCalled` helper removed, use `hasToolCall` from `'ai'` instead
  - **Structured Output API**: `experimental_output` promoted to stable `output` in AI SDK v6
  - **Usage Properties**: Token usage now uses `inputTokens`/`outputTokens` instead of `promptTokens`/`completionTokens`

  ## New Features
  - **Full AI SDK v6 Compatibility**: All features align with official AI SDK v6 specification
  - **Re-exported Utilities**: Stream utilities, middleware, and agents from official SDK for consistency
  - **Improved Type Safety**: Full TypeScript support with LanguageModelV3 specification
  - **Reranking Support**: Native reranking API support (AI SDK v6 feature)
  - **MCP Support**: Full MCP integration support (OAuth, resources, prompts, elicitation)

  ## Migration Guide
  1. **Update Dependencies**:
     ```bash
     npm install ai-sdk-ollama ai@^6.0.0
     ```
  2. **Update Imports**:

     ```typescript
     // Before
     import { ToolLoopAgent, toolCalled } from 'ai-sdk-ollama';
     import { parsePartialJson } from 'ai-sdk-ollama';

     // After
     import { ollama } from 'ai-sdk-ollama';
     import { ToolLoopAgent, hasToolCall, parsePartialJson } from 'ai';
     ```

  3. **Update Structured Output**:

     ```typescript
     // Before
     experimental_output: Output.object({ schema });

     // After
     output: Output.object({ schema });
     ```

  4. **Update Stop Conditions**:

     ```typescript
     // Before
     stopWhen: [toolCalled('done')];

     // After
     stopWhen: [hasToolCall('done')];
     ```

  5. **Update Usage Properties**:

     ```typescript
     // Before
     result.usage.promptTokens;
     result.usage.completionTokens;

     // After
     result.usage.inputTokens;
     result.usage.outputTokens;
     result.totalUsage.inputTokens; // For agents
     ```

  ## Improvements
  - **Reduced Bundle Size**: Removed duplicate implementations, now re-exporting from official SDK
  - **Better Maintainability**: Aligned with official SDK to prevent drift
  - **Enhanced Type Safety**: Full LanguageModelV3 specification support
  - **Consistent APIs**: All utilities follow official AI SDK patterns

## 2.2.0

### Minor Changes

- 72a26e3: ### Fixed
  - **Real-time streaming for flow-based UIs**: Fixed issue where `streamText`'s `fullStream` was waiting for completion before emitting events, causing flow interfaces to only receive control events (start, finish) without text or tool call events. The enhanced `fullStream` now streams all events (text-delta, tool-call, tool-result) in real-time as they occur. Resolves [#344](https://github.com/jagreehal/ai-sdk-ollama/issues/344).

  ### Added
  - **`stopWhen` support**: Added support for the `stopWhen` property in both `streamText` and `generateText` functions, allowing users to customize multi-turn tool calling behavior. When not provided and tools are enabled, defaults to `stepCountIs(5)` for multi-turn tool calling.

  ### Improved
  - **AI SDK compatibility**: Enhanced both `streamText` and `generateText` to automatically support all AI SDK properties using `Parameters<typeof _streamText>[0]` type extraction, ensuring 100% forward compatibility with future AI SDK changes without manual updates.

## 2.1.0

### Minor Changes

- 285e4e4: Enhanced `streamText` wrapper to support `fullStream` with synthesis
  - Added synthesis support for `fullStream` in addition to `textStream`
  - When tool-calling models (like `gpt-oss:120b`) invoke tools without generating text first, the enhanced `fullStream` now automatically synthesizes a response based on tool results
  - Emits proper `TextStreamPart` events (`text-start`, `text-delta`, `text-end`) for flow-based UIs
  - Fixes issue where flow interfaces only received control events (`start`, `finish`) without any text content when models called tools first

## 2.0.1

### Patch Changes

- 826eb83: Add API key configuration support for cloud Ollama services
  - Added `apiKey` parameter to `createOllama` options
  - API key is automatically set as `Authorization: Bearer {apiKey}` header
  - Existing Authorization headers take precedence over apiKey
  - Added header normalization to handle Headers instances, arrays, and plain objects
  - Updated README with API key configuration examples for different runtimes (Node.js, Bun, Deno, serverless)

## 2.0.0

### Major Changes

- a23b4a5: ## Breaking Change: Rename `reasoning` to `think`

  The `reasoning` parameter in `OllamaChatSettings` has been renamed to `think` to align with Ollama's native API parameter name. This change ensures consistency with the official Ollama API and improves type safety by using `Pick<ChatRequest, 'keep_alive' | 'format' | 'tools' | 'think'>`.

  ### Migration Guide

  **Before:**

  ```typescript
  const model = ollama('gpt-oss:20b-cloud', { reasoning: true });
  ```

  **After:**

  ```typescript
  const model = ollama('gpt-oss:20b-cloud', { think: true });
  ```

  ### What Changed
  - Removed `reasoning?: boolean` from `OllamaChatSettings`
  - Added `think` parameter via `Pick<ChatRequest, 'keep_alive' | 'format' | 'tools' | 'think'>`
  - Updated all internal references from `this.settings.reasoning` to `this.settings.think`
  - Updated examples and tests to use the new `think` parameter

  The functionality remains the same - only the parameter name has changed to match Ollama's API.

## 1.1.0

### Minor Changes

- 201b13b: Add `keep_alive` parameter support and improve type safety

  ### Added
  - **`keep_alive` parameter**: Control how long models stay loaded in memory after requests
    - Accepts duration strings (e.g., `"10m"`, `"24h"`), numbers in seconds, negative numbers for indefinite, or `0` to unload immediately
    - Works across all chat operations (generate, stream, tool calling, object generation)

  ### Improved
  - **Type safety**: Now uses `Pick<ChatRequest, 'keep_alive' | 'format' | 'tools'>` from the official ollama-js package
  - **Type consistency**: `OllamaProviderSettings` extends `Pick<Config, 'headers' | 'fetch'>` and `OllamaEmbeddingSettings` extends `Pick<EmbedRequest, 'dimensions'>`
  - **Type exports**: Re-export more types from ollama-js for better developer experience (`ChatRequest`, `EmbedRequest`, `Config`, `ToolCall`, `Tool`, `Message`, `ChatResponse`, `EmbedResponse`)

## 1.0.2

### Patch Changes

- 444c16e: Update AI SDK dependencies to version 5.0.97 and @ai-sdk/react to 2.0.97 in examples. Also update rimraf to 6.1.2 across the project.

## 1.0.1

### Patch Changes

- 2110218: Update dependencies:
  - Update `@ai-sdk/provider-utils` to `^3.0.15`
  - Update `ai` peer dependency to `^5.0.86`
  - Update `vitest` to `^4.0.6`

## 1.0.0

### Major Changes

- 30d2450: ## Fixed Tool Calling Message Conversion

  Fixed critical issues with tool calling message conversion that were preventing proper multi-turn conversations:

  ### Changes
  - **Tool result messages**: Now use proper `role: 'tool'` with `tool_name` field instead of `role: 'user'` with `[Tool Result]:` prefix
  - **Assistant messages**: Properly include `tool_calls` array for tool execution
  - **Finish reason handling**: Returns `'tool-calls'` when tools execute to enable conversation continuation
  - **Reliable tool calling**: Disabled by default (`?? false`) for better AI SDK compatibility
  - **Test updates**: Updated all test expectations to match new message format

  ### Impact
  - ✅ Standard AI SDK `generateText` and `streamText` now work perfectly with ai-sdk-ollama provider
  - ✅ Full compatibility with AI SDK ecosystem and multi-turn tool calling
  - ✅ Enhanced functions still provide synthesis and reliability features when needed
  - ✅ Users can choose between standard (compatible) or enhanced (reliable) approaches

  This ensures both standard AI SDK patterns and enhanced ai-sdk-ollama functions work seamlessly for tool calling scenarios.

## 0.13.0

### Minor Changes

- 7bb9fdd: update deps

## 0.12.0

### Minor Changes

- 34c3e3b: # Enhanced generateText with Automatic Response Synthesis

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
    tools: { math: mathTool },
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
      condition: z.string(),
    }),
    enhancedOptions: {
      enableToolsWithStructuredOutput: true, // Opt-in feature
    },
  });

  // Combines tool execution with structured output
  console.log(result.experimental_output); // Properly typed schema
  ```

  ## Technical Details
  - Uses `Object.create()` and `Object.getOwnPropertyDescriptors()` to preserve prototype methods
  - Synthesis attempts up to 2 times with configurable prompts
  - Maintains full compatibility with AI SDK's type system
  - Enhanced responses include combined token usage from both tool execution and synthesis phases

## 0.11.0

### Minor Changes

- fb666c1: Enhanced JSON repair for reliable object generation
  - **New Feature**: Added `enhancedRepairText` function that automatically fixes 14+ types of common JSON issues from LLM outputs
  - **Improved Reliability**: Enhanced `objectGenerationOptions` with comprehensive JSON repair capabilities including:
    - Markdown code block extraction
    - Comment removal
    - Smart quote fixing
    - Unquoted key handling
    - Trailing comma removal
    - Incomplete object/array completion
    - Python constant conversion (True/False/None)
    - JSONP wrapper removal
    - Single quote to double quote conversion
    - URL and escaped quote handling
    - Ellipsis pattern resolution
  - **New Example**: Added `json-repair-example.ts` demonstrating enhanced repair capabilities
  - **Enhanced Configuration**: `enableTextRepair` now defaults to `true` for better out-of-the-box reliability
  - **Comprehensive Testing**: Added extensive test suite covering all repair scenarios
  - **Backward Compatible**: All existing functionality remains unchanged

## 0.10.1

### Patch Changes

- 7108a12: Fix synthesis conflict between `messages` and `prompt` parameters in `streamText` and `generateText`. The synthesis logic now correctly detects whether the original call used `messages` or `prompt` and constructs the follow-up synthesis call accordingly, preventing "prompt field is not supported when messages is specified" errors when using the `messages` + `system` pattern with tool calling.

## 0.10.0

### Minor Changes

- c6bb667: ## ✨ Browser Example: React + AI Elements Migration

  ### 🚀 Major Changes

  **Browser Example Overhaul:**
  - **Migrated from vanilla JS to React**: Complete rewrite using React 19 and modern hooks
  - **Added AI Elements integration**: Now uses `@ai-sdk/react` with `useChat` hook and AI Elements components
  - **Implemented shadcn/ui components**: Modern, accessible UI components with Tailwind CSS
  - **Enhanced streaming architecture**: Uses `toUIMessageStreamResponse()` for proper UI message handling
  - **Added comprehensive AI Elements**: 20+ AI-specific components (Message, Response, Conversation, PromptInput, etc.)

  **New Features:**
  - Real-time model loading and selection from Ollama API
  - Dynamic connection status with visual indicators
  - Model size formatting and fallback options
  - Enhanced error handling and loading states
  - Responsive design with modern card-based layout

  **Technical Improvements:**
  - TypeScript-first implementation with full type safety
  - Vite API plugin for seamless Ollama integration
  - Proper message streaming with UI message format
  - Component-based architecture for better maintainability

  ### 📦 Dependencies Updated

  **AI SDK:**
  - `ai`: `^5.0.56` → `^5.0.57`
  - `@ai-sdk/react`: `^2.0.57` (new)

  **React:**
  - `react`: `^19.1.1` (new)
  - `react-dom`: `^19.1.1` (new)
  - `@types/react`: `^19.1.14` → `^19.1.15`

  **Development:**
  - `@types/node`: `^24.5.2` → `^24.6.0`
  - `@typescript-eslint/*`: `^8.44.1` → `^8.45.0`
  - `typescript-eslint`: `^8.44.1` → `^8.45.0`

  ### 🗂️ File Changes

  **Added:**
  - `examples/browser/main.tsx` - React entry point
  - `examples/browser/src/App.tsx` - Main application component
  - `examples/browser/src/components/ai-elements/` - 20 AI Elements components
  - `examples/browser/vite-api-plugin.ts` - Vite plugin for Ollama API
  - `examples/browser/components/ui/card.tsx` - shadcn/ui card component

  **Removed:**
  - `examples/browser/main.ts` - Old vanilla JS entry point

  **Updated:**
  - `examples/browser/package.json` - React dependencies and AI Elements
  - `examples/browser/README.md` - Complete rewrite with new architecture
  - `examples/browser/index.html` - Updated for React
  - `examples/browser/vite.config.js` - Added API plugin integration

## 0.9.0

### Minor Changes

- 35f19de: Add web search and web fetch tools for Ollama integration
  - Add `webSearch` tool for performing web searches using Ollama's web search capabilities
  - Add `webFetch` tool for fetching web content and URLs
  - Support for both browser and Node.js environments
  - Comprehensive integration tests and examples
  - Updated documentation with usage examples and prerequisites

## 0.8.1

### Patch Changes

- e57ddf2: ## Enhanced Function Renaming & Documentation Improvements

  ### Function Renaming
  - Renamed `generateTextOllama` to `generateText` (enhanced version from ai-sdk-ollama)
  - Renamed `streamTextOllama` to `streamText` (enhanced version from ai-sdk-ollama)
  - Maintains backward compatibility while providing clearer API

  ### Documentation Improvements
  - **README.md**: Complete restructure with better user flow
    - Added Quick Start section with immediate installation and basic example
    - Moved value proposition ("Why Choose") section earlier
    - Added dedicated "Enhanced Tool Calling" section highlighting main differentiator
    - Reorganized examples under "More Examples" for better progression
    - Removed redundant content and improved clarity
  - **packages/ai-sdk-ollama/README.md**: Applied same improvements
    - Consistent structure with main README
    - Better user journey from basic to advanced features
    - Updated table of contents to match new structure

  ### Key Benefits
  - **Better Developer Experience**: Clearer function names and improved documentation flow
  - **Enhanced Tool Calling**: Highlighted the main selling point with dedicated section
  - **User-Friendly**: Users can now get started in 30 seconds and understand value immediately
  - **Consistent**: Both READMEs now have the same improved structure and flow

## 0.8.0

### Minor Changes

- 7ce6ed0: Enhanced tool calling with reliable wrapper functions

  ## What's New
  - **New Enhanced Wrapper Functions**: Added `generateTextOllama()` and `streamTextOllama()` for guaranteed tool calling reliability
  - **Automatic Response Synthesis**: Enhanced functions automatically complete responses when tools are executed but return empty text
  - **Configurable Reliability Options**: Control synthesis behavior with `enhancedOptions` parameter
  - **Improved Documentation**: Comprehensive examples and comparison tables for standard vs enhanced functions

  ## Key Features
  - **Reliable Tool Calling**: Standard `generateText()` may return empty responses after tool execution. Enhanced wrappers guarantee complete, useful responses every time
  - **Backward Compatible**: All existing code continues to work unchanged
  - **Production Ready**: Designed for critical applications that can't handle unpredictable empty responses
  - **Cross Provider Compatible**: Enhanced functions work with any AI SDK provider

  ## Breaking Changes

  None - this is a purely additive enhancement.

  ## Migration

  No migration required. Existing code works unchanged. To get enhanced reliability:

  ```typescript
  // Before (may return empty text after tool calls)
  const { text } = await generateText({
    model: ollama('llama3.2'),
    tools,
    prompt,
  });

  // After (guaranteed complete responses)
  const { text } = await generateTextOllama({
    model: ollama('llama3.2'),
    tools,
    prompt,
  });
  ```

## 0.7.0

### Minor Changes

- 8f0a292: Comprehensive reliability improvements and new Ollama-specific functions

  ## New Features

  ### Ollama-Specific AI Functions
  - **generateTextOllama**: Enhanced text generation with reliability features
  - **generateObjectOllama**: Structured object generation with schema validation
  - **streamTextOllama**: Real-time text streaming with tool calling support
  - **streamObjectOllama**: Progressive object streaming with reliability features

  ### Reliability Features
  - **Tool Calling Reliability**: Enhanced tool calling with retry logic and parameter normalization
  - **Object Generation Reliability**: Schema validation, type mismatch fixing, and fallback generation
  - **Streaming Reliability**: Better stop conditions and response synthesis
  - **Error Recovery**: Automatic retry mechanisms and graceful error handling

  ## Examples and Documentation

  ### New Example Files
  - **Comprehensive Demo**: `generate-all-ollama-demo.ts` - showcases all Ollama-specific functions
  - **Streaming Demos**: `stream-text-ollama-demo.ts` and `stream-object-ollama-demo.ts`
  - **Debug Tools**: `debug-streaming-issue.ts` and `debug-gpt-oss-tools.ts`
  - **Testing Examples**: Various test files for different use cases

  ### Enhanced Examples
  - **Browser Example**: Fixed to use `createOllama()` for proper provider configuration
  - **Node Examples**: Updated with better error handling and TypeScript compliance
  - **Tool Calling**: Comprehensive examples with weather and search tools

  ## Technical Improvements

  ### TypeScript Fixes
  - Fixed variable naming conflicts in all example files
  - Resolved async/await issues with tool calls
  - Fixed Zod schema definitions for record types
  - Improved type safety across all examples

  ### API Enhancements
  - Better error messages and debugging information
  - Enhanced configuration options for reliability features
  - Improved streaming performance and reliability
  - Better integration with Ollama's native capabilities

  ## Breaking Changes

  None - all changes are backward compatible

  ## Migration Guide

  Existing code continues to work unchanged. New Ollama-specific functions are available as additional options for enhanced reliability.

## 0.6.2

### Patch Changes

- 0e2f392: Fix TypeScript compilation errors in examples
  - Fixed variable naming conflicts in stream-vs-generate-test.ts, debug-streaming-issue.ts, generate-all-ollama-demo.ts, stream-object-ollama-demo.ts, and stream-text-ollama-demo.ts
  - Fixed undefined variable 'ollamaRaw' in existing-client-example.ts
  - Fixed browser example to use createOllama() instead of passing baseURL to ollama() function
  - Fixed async tool calls access in streaming examples
  - Fixed Zod schema definitions for record types
  - All examples now compile and run successfully

## 0.6.1

### Patch Changes

- 80fbf5b: Update to ollama-0.5.18
  - Updated Ollama provider to support version 0.5.18
  - Enhanced embedding model functionality
  - Improved provider implementation with better error handling
  - Updated examples to demonstrate new features

## 0.6.0

### Minor Changes

- a7e2377: Allow passing an existing Ollama client to `createOllama` and expose raw client/methods for direct model operations. Closes #67.

## 0.5.5

### Patch Changes

- 12d4f4a: ai ^5.0.35 → ^5.0.37

## 0.5.4

### Patch Changes

- 6e39959: chore: bump ai to ^5.0.30

## 0.5.3

### Patch Changes

- e58649c: chore: bump ai to ^5.0.29

## 0.5.2

### Patch Changes

- 96ec6dc: Updated to ai v5.0.23

## 0.5.1

### Patch Changes

- edb4d47: Updated ai package version to 5.0.15

## 0.5.0

### Minor Changes

- Add browser support with automatic environment detection
  - Add browser-specific provider using ollama/browser package
  - Implement dual package exports for Node.js and browser environments
  - Add comprehensive browser example with Vite and interactive UI
  - Update build configuration to generate separate browser and Node.js bundles
  - Add browser compatibility tests and examples

- e02f8af: Feature: Browser support and streaming improvements. Closes https://github.com/jagreehal/ai-sdk-ollama/issues/14
  - feat(browser): Automatic browser support via `ollama/browser` with dedicated `index.browser` export. Works seamlessly with bundlers and `ai` v5 in browser contexts.
  - fix(streaming): Emit trailing `text-delta` on the final `done` chunk to avoid empty streams for models that only flush content at the end. Note: streams may include one additional text chunk now.
  - tests: Add `gpt-oss:20b` integration coverage and make prompts/token limits more robust; update unit tests to reflect final text emission on `done`.
  - docs/examples: Switch Node examples to per-file `tsx` execution and update READMEs; clarify how to run browser and node examples.
  - chore(repo): Monorepo migration (no user-facing API changes), Dependabot config for package folder, and CI refinements.

  No breaking changes to the public API.

## 0.4.0

### Minor Changes

- **Reasoning Support**: Added support for reasoning (chain-of-thought) output
  - 🧠 **Reasoning Content**: Models that support reasoning can now output their thinking process
  - 📝 **Content Types**: Support for `LanguageModelV2Reasoning` content type in both non-streaming and streaming responses
  - 🔄 **Streaming Support**: Full streaming support with `reasoning-start`, `reasoning-delta`, and `reasoning-end` events
  - ⚙️ **Configurable**: Enable reasoning with `{ reasoning: true }` setting
  - 🧪 **Comprehensive Testing**: Added unit tests for reasoning functionality
  - 📚 **Documentation**: Updated README and examples with reasoning usage
  - 🎯 **Backward Compatible**: Reasoning is disabled by default, existing code continues to work

### Technical Improvements

- Added `reasoning` setting to `OllamaChatSettings` interface
- Enhanced `doGenerate` method to handle `thinking` field from Ollama responses
- Enhanced `doStream` method to emit reasoning stream parts
- Added reasoning support to content conversion logic
- Updated type definitions to include reasoning content types

## 0.3.0

### Minor Changes

- **Auto-Structured Outputs**: Enhanced structured outputs with intelligent auto-detection
  - 🎯 **Smart Auto-Detection**: Automatically enables structured outputs when JSON schema is provided
  - 🔧 **Backward Compatibility**: Explicit `structuredOutputs: true/false` settings are still respected
  - ⚠️ **User-Friendly Warnings**: Clear warnings when auto-enabling structured outputs
  - 📚 **Enhanced Documentation**: Updated examples and README with auto-detection guidance
  - 🧪 **Comprehensive Testing**: Added integration tests for auto-detection scenarios
  - 🛠️ **Improved Developer Experience**: No need to manually set `structuredOutputs: true` for object generation

### Technical Improvements

- Enhanced `shouldEnableStructuredOutputs()` method for intelligent auto-detection
- Improved schema validation and error handling
- Updated README with auto-detection examples and best practices
- Added comprehensive integration tests for edge cases
- Streamlined configuration for common use cases

## 0.2.0

### Minor Changes

- bf0905a: Fix streaming examples and improve TypeScript type checking
  - Fix "Stream error: text part not found" by using textStream instead of fullStream for basic streaming
  - Fix TypeScript errors in all examples (error handling, index access, undefined checks)
  - Remove rootDir restriction in tsconfig.json to enable type checking for examples
  - Fix tool call parameter handling and error messages
  - Remove deprecated model capabilities and suggestions utilities
  - Improve error handling with proper type checking throughout examples
  - Update streaming examples to work with AI SDK v5 API changes

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2025-08-06

### Added

- 🎉 Initial release of AI SDK Ollama Provider
- ✅ Full support for Vercel AI SDK v5 (`LanguageModelV2` and `EmbeddingModelV2`)
- 🤖 **Chat Language Model** with streaming support
  - Text generation with **dual parameter support** (AI SDK standard + native Ollama)
  - **Cross provider compatibility** via AI SDK parameters (temperature, maxOutputTokens, etc.)
  - **Advanced Ollama features** via native options (mirostat, num_ctx, etc.)
  - **Parameter precedence system** - Ollama options override AI SDK parameters
  - Structured output support (JSON objects)
  - Tool calling capabilities
  - Image input support (with compatible models)
- 🔍 **Embedding Model** for text embeddings
  - Batch embedding support (up to 2048 texts)
  - Support for all Ollama embedding models
- 🧠 **Model Intelligence System**
  - Comprehensive model capability database
  - Smart model suggestions based on requirements
  - Automatic feature detection and validation
  - Helpful error messages with actionable recommendations
- 🛠️ **Provider Features**
  - Official `ollama` package integration with **direct option pass-through**
  - **Future proof**: All current and future Ollama parameters supported automatically
  - Custom base URL configuration
  - Custom headers support
  - Custom fetch implementation
  - Comprehensive error handling with custom OllamaError class
- 📦 **Modern Package**
  - TypeScript with full type safety
  - ES modules with CommonJS compatibility
  - Node.js 22+ support
  - Clean, organized codebase structure
- 🧪 **Quality Assurance**
  - Tests (unit + integration)
  - Full TypeScript coverage
  - Linting with ESLint + Prettier
  - Automated testing with Vitest
- 📚 **Examples & Documentation**
  - 8 comprehensive examples covering all features
  - Basic chat, streaming, tool calling, embeddings
  - Dual parameter demonstrations
  - Model capabilities and validation examples
  - Comprehensive README with AI SDK v5+ compatibility
- 🖼️ **Image Processing Support**: Complete implementation of AI SDK v5 image handling with Ollama
  - Support for image URLs, base64 encoded images, and multiple images
  - Full integration with vision models like LLaVA and bakllava
  - Streaming support with images
  - Mixed content types (text + image + text)

### Technical Details

- Built with AI SDK v5 (`@ai-sdk/provider: ^2.0.0`)
- Uses official Ollama client (`ollama: ^0.5.16`)
- Requires Node.js >=22
- Fully typed with TypeScript 5.9+
- ES module first with CJS fallback

### Supported Models

- **Chat Models**: llama3.2, mistral, phi4-mini, qwen2.5, codellama, and all Ollama chat models
- **Vision Models**: llava, bakllava, llama3.2-vision, minicpm-v
- **Embedding Models**: nomic-embed-text, all-minilm, mxbai-embed-large, and all Ollama embedding models

[0.1.0]: https://github.com/jagreehal/ai-sdk-ollama/releases/tag/v0.1.0
