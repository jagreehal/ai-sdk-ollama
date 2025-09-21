---
"ai-sdk-ollama": minor
---

Comprehensive reliability improvements and new Ollama-specific functions

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
