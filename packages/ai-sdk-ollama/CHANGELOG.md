# Changelog

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
