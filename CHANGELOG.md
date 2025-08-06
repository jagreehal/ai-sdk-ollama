# Changelog

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

- **Chat Models**: llama3.2, llama3.1, mistral, phi4-mini, qwen2.5, codellama, and all Ollama chat models
- **Vision Models**: llava, bakllava, llama3.2-vision, minicpm-v
- **Embedding Models**: nomic-embed-text, all-minilm, mxbai-embed-large, and all Ollama embedding models

[0.1.0]: https://github.com/jagreehal/ai-sdk-ollama/releases/tag/v0.1.0
