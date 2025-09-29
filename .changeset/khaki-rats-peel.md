---
'ai-sdk-ollama': minor
---

## ✨ Browser Example: React + AI Elements Migration

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
