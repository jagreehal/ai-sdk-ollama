# AI SDK Ollama Provider Monorepo

[![npm version](https://badge.fury.io/js/ai-sdk-ollama.svg)](https://badge.fury.io/js/ai-sdk-ollama)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9+-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-22+-green.svg)](https://nodejs.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A monorepo containing the AI SDK Ollama Provider and examples demonstrating usage in both Node.js and browser environments.

## 📦 Packages

### [`ai-sdk-ollama`](./packages/ai-sdk-ollama)

The main package - a Vercel AI SDK v5+ provider for Ollama built on the official `ollama` package. Features:

- ✅ **Cross-environment support** - Works in Node.js and browsers
- ✅ **Type-safe** - Full TypeScript support with strict typing
- ✅ **Cross-provider compatible** - Drop-in replacement for other AI SDK providers
- ✅ **Native Ollama features** - Access to Ollama-specific options and parameters
- ✅ **Browser support** - Automatic environment detection with `ollama/browser`

## 🚀 Examples

### [`examples/node`](./examples/node)

Node.js examples (run individually with tsx):

- Basic text generation
- Streaming responses
- Structured object generation with Zod schemas
- Advanced Ollama-specific configuration

Run any example from the repo root:

```bash
npx tsx examples/basic-chat.ts
# or
npx tsx examples/dual-parameter-example.ts
```

### [`examples/browser`](./examples/browser)

Interactive browser example featuring:

- Vite-powered development environment
- Real-time text generation and streaming
- Model configuration UI
- CORS proxy setup for Ollama access

## 🛠️ Development

This monorepo uses [pnpm workspaces](https://pnpm.io/workspaces) and [Turborepo](https://turbo.build/) for efficient development and build processes.

### Prerequisites

- Node.js 22+
- pnpm 8+
- [Ollama](https://ollama.com) installed locally

### Quick Start

```bash
# Clone and install dependencies
git clone https://github.com/jagreehal/ai-sdk-ollama.git
cd ai-sdk-ollama
pnpm install

# Build all packages
pnpm build

# Start Ollama (required for examples and integration tests)
ollama serve

# Pull a model
ollama pull llama3.2
```

### Available Scripts

```bash
# Build all packages and examples
pnpm build

# Run all linting
pnpm lint

# Run all unit tests
pnpm test

# Run integration tests (requires Ollama running)
pnpm test:integration

# Type check all packages
pnpm type-check

# Clean all build artifacts
pnpm clean
```

### Working with Specific Packages

```bash
# Build only the main package
pnpm --filter ai-sdk-ollama build

# Run a Node.js example directly with tsx
npx tsx examples/basic-chat.ts

# Start the browser example dev server
pnpm --filter @examples/browser dev

# Run tests for the main package only
pnpm --filter ai-sdk-ollama test
```

## 📖 Usage

### Installation

```bash
npm install ai-sdk-ollama ai@^5.0.0
```

### Basic Usage

```typescript
import { ollama } from 'ai-sdk-ollama';
import { generateText } from 'ai';

// Works in both Node.js and browsers
const { text } = await generateText({
  model: ollama('llama3.2'),
  prompt: 'Write a haiku about coding',
  temperature: 0.8,
});

console.log(text);
```

### Browser Environment

The library automatically detects browser environments and uses the CORS-compatible `ollama/browser` client:

```typescript
import { ollama } from 'ai-sdk-ollama'; // Automatically uses browser version
// or explicitly:
import { ollama } from 'ai-sdk-ollama/browser';
```

**CORS Setup**: Ensure your Ollama server allows browser requests:

```bash
OLLAMA_ORIGINS=* ollama serve
```

## 🏗️ Architecture

- **Monorepo Structure**: Clean separation of library code and examples
- **Turborepo**: Efficient task runner with intelligent caching
- **Environment Detection**: Automatic Node.js vs browser client selection
- **TypeScript**: Strict typing throughout with shared configurations
- **Testing**: Unit and integration test suites with Vitest
- **CI/CD**: GitHub Actions with Dependabot auto-merge

## 🔄 Release Process

This monorepo uses [Changesets](https://github.com/changesets/changesets) for version management:

```bash
# Add a changeset
pnpm changeset

# Version packages (done in CI)
pnpm version-packages

# Release (done in CI)
pnpm release
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new features
5. Run `pnpm build && pnpm lint && pnpm test`
6. Submit a pull request

## 📄 License

MIT © [Jag Reehal](https://jagreehal.com)

---

For detailed documentation, see the [main package README](./packages/ai-sdk-ollama/README.md).
