# Changelog

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
