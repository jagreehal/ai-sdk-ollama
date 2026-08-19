# AI SDK Ollama Browser Example

A modern React-based browser example demonstrating the ai-sdk-ollama provider with AI Elements and shadcn/ui components.

- ✅ **React + AI Elements**: Modern component-based architecture
- ✅ **AI SDK Integration**: Uses `useChat` hook with `toUIMessageStreamResponse`
- ✅ **UI**: shadcn/ui components with Tailwind CSS
- ✅ **Real-time Streaming**: Live text streaming with proper UI message handling
- ✅ **Model Management**: Dynamic model loading and selection
- ✅ **TypeScript**: Full type safety and IntelliSense support
- ✅ **MCP Apps**: Interactive `ui://` resources rendered via `experimental_MCPAppRenderer` in a sandboxed iframe

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

## 🧩 MCP Apps

The browser example includes an MCP Apps host. When the model calls a tool that
declares a `ui://` resource (e.g. `showDashboard`), the response is rendered as
an interactive HTML app inside a sandboxed iframe using `experimental_MCPAppRenderer`.

- A shared stdio MCP server (`../node/src/mcp-apps-server.mjs`) provides the
  demo dashboard resource and tools.
- The Vite dev server proxies `read-resource` and `call-tool` requests and
  enforces app-visible tool access.
- Try it: click **"Show me a dashboard"** in the chat.

See the [AI SDK MCP Apps docs](https://ai-sdk.dev/docs/ai-sdk-core/mcp-apps) for details.

## 💻 How It Works

### React + AI Elements Architecture

The example uses React with AI Elements for a modern, component-based approach:

```tsx
import { useChat } from '@ai-sdk/react';
import { Conversation, ConversationContent } from './components/ai-elements/conversation';
import { Message, MessageContent } from './components/ai-elements/message';
import { PromptInput, PromptInputTextarea } from './components/ai-elements/prompt-input';

function App() {
  const { messages, sendMessage, status } = useChat();
  
  return (
    <Conversation>
      <ConversationContent>
        {messages.map((message) => (
          <Message key={message.id} from={message.role}>
            <MessageContent>{message.content}</MessageContent>
          </Message>
        ))}
      </ConversationContent>
      <PromptInput onSubmit={handleSubmit}>
        <PromptInputTextarea placeholder="Enter your message..." />
      </PromptInput>
    </Conversation>
  );
}
```

### API Integration with AI Elements

The example uses a custom Vite plugin to handle API routes with proper `toUIMessageStreamResponse`:

```javascript
// vite-api-plugin.ts
export function apiPlugin(): Plugin {
  return {
    name: 'api-plugin',
    configureServer(server) {
      server.middlewares.use('/api/chat', async (req, res, next) => {
        const result = await streamText({
          model: ollama(model),
          messages: convertToModelMessages(messages),
        });
        
        // Use AI Elements' toUIMessageStreamResponse
        const response = result.toUIMessageStreamResponse();
        // Forward response...
      });
    },
  };
}
```

This provides:

- **AI Elements Compatibility**: Proper `toUIMessageStreamResponse` integration
- **Real-time Streaming**: Live UI message streaming
- **No CORS Issues**: Seamless development experience
- **Type Safety**: Full TypeScript support

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
- ✅ Check for TypeScript errors: `pnpm quality`
