# AI SDK Ollama Browser Example

A comprehensive, modern browser example demonstrating the ai-sdk-ollama provider with a beautiful UI and full Playwright test coverage.

- ✅ Browser-compatible Ollama client using `ollama/browser`
- ✅ Text generation with `generateText()`
- ✅ Streaming text with `streamText()`
- ✅ Model configuration and parameter customization
- ✅ Real-time model loading from Ollama API
- ✅ Error handling and status updates

## 📋 Prerequisites

1. **Ollama Server**: Make sure Ollama is running locally:

   ```bash
   ollama serve
   ```

2. **Models**: Pull at least one model (llama3.2 recommended):

   ```bash
   ollama pull llama3.2
   ```

3. **No CORS Configuration Needed**: The Vite proxy handles CORS automatically!

## 🚀 Quick Start

### From the monorepo root

```bash
# Install dependencies
pnpm install

# Start the development server
pnpm --filter @examples/browser dev
```

### Or from the browser example directory

```bash
# Navigate to the example
cd examples/browser

# Install dependencies (if not done from root)
pnpm install

# Start the development server
pnpm dev
```

The example will be available at **http://localhost:3000/** (port may vary if 3000 is in use).

## 💻 How It Works

### Browser-Optimized Architecture

The example uses the browser-specific build of ai-sdk-ollama with automatic environment detection:

```javascript
import { createOllama } from 'ai-sdk-ollama';
import { generateText, streamText } from 'ai';

// Automatically uses 'ollama/browser' in browser environments
const ollama = createOllama({
  baseURL: window.location.origin, // Uses Vite proxy
});

// Works exactly like the Node.js version
const { text } = await generateText({
  model: ollama('llama3.2'),
  prompt: 'Write a haiku about coding',
  temperature: 0.7,
  maxOutputTokens: 500,
});
```

### Vite Proxy Configuration

The included `vite.config.js` automatically handles CORS by proxying API requests:

```javascript
export default defineConfig({
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:11434',
        changeOrigin: true,
        secure: false,
      },
    },
  },
});
```

This means:

- No need for `OLLAMA_ORIGINS=*` configuration
- Seamless development experience
- Production-ready proxy setup

## 🌐 Browser vs Node.js

The library automatically selects the correct implementation:

| Environment | Implementation   | Features                                |
| ----------- | ---------------- | --------------------------------------- |
| **Browser** | `ollama/browser` | CORS-aware, fetch-based, no file system |
| **Node.js** | `ollama`         | HTTP client, file system access         |

The API remains **identical** between environments - write once, run anywhere!

## 🐛 Troubleshooting

### Connection Issues

- ✅ Ensure Ollama is running: `ollama serve`
- ✅ Check Ollama is accessible at `http://localhost:11434`
- ✅ Verify models are installed: `ollama list`
- ✅ Check browser console for errors

### Model Loading Issues

- ✅ Try refreshing models with the refresh button
- ✅ Check network requests in browser DevTools
- ✅ Verify Vite proxy is working (should see proxy logs)

### Build Issues

- ✅ Build the parent package first: `pnpm build` (from monorepo root)
- ✅ Clear node_modules and reinstall: `rm -rf node_modules && pnpm install`
- ✅ Check for TypeScript errors: `pnpm type-check`
