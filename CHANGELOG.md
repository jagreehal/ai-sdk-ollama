# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2025-08-04

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
  - 113 comprehensive tests (unit + integration)
  - Full TypeScript coverage
  - Linting with ESLint + Prettier
  - Automated testing with Vitest
- 📚 **Examples & Documentation**
  - 8 comprehensive examples covering all features
  - Basic chat, streaming, tool calling, embeddings
  - Dual parameter demonstrations
  - Model capabilities and validation examples
  - Comprehensive README with AI SDK v5+ compatibility

### Technical Details

- Built with AI SDK v5 (`@ai-sdk/provider: ^2.0.0`)
- Uses official Ollama client (`ollama: ^0.5.16`)
- Requires Node.js >=22
- Fully typed with TypeScript 5.9+
- ES module first with CJS fallback

### Supported Models

- **Chat Models**: llama3.2, llama3.1, mistral, phi4-mini, qwen2.5, codellama, and all Ollama chat models
- **Vision Models**: llama3.2-vision, llava, minicpm-v
- **Embedding Models**: nomic-embed-text, all-minilm, mxbai-embed-large, and all Ollama embedding models

## [0.1.1] - 2025-01-07

### Fixed

- 🔧 **Streaming Implementation**: Fixed text part ID consistency in streaming (was generating new UUIDs for each chunk)
- 🔧 **Build Errors**: Fixed `created_at` Date object conversion to string for JSONValue compatibility
- 🔧 **TypeScript Linting**: Removed all `any` types for better type safety
- 🔧 **Documentation**: Updated README.md and examples to explicitly mention AI SDK v5+ compatibility

### Improved

- 📚 **Documentation**: Enhanced README.md with AI SDK v5+ requirements and installation instructions
- 🧪 **Testing**: All 113 tests now passing with comprehensive coverage
- 🚀 **Examples**: Verified all 8 examples working correctly with proper error handling
- 🎯 **Developer Experience**: Improved error messages and model suggestions

### Technical Improvements

- **Streaming Reliability**: Consistent text part IDs prevent "text part not found" errors
- **Type Safety**: Enhanced TypeScript implementation with strict typing
- **Error Handling**: Better error messages with actionable suggestions
- **Build Process**: All builds now pass successfully (CJS, ESM, and DTS)

[0.1.1]: https://github.com/jagreehal/ai-sdk-ollama/releases/tag/v0.1.1
[0.1.0]: https://github.com/jagreehal/ai-sdk-ollama/releases/tag/v0.1.0
