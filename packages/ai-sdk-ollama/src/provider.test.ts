import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Ollama } from 'ollama';
import { createOllama } from './provider';

describe('createOllama', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create a new Ollama client when no client is provided', () => {
    const provider = createOllama({
      baseURL: 'http://test-host:11434',
      headers: { 'X-Test': 'test-value' },
    });

    expect(provider).toBeDefined();
    expect(typeof provider).toBe('function');
    expect(provider.chat).toBeDefined();
    expect(provider.embedding).toBeDefined();
  });

  it('should use existing Ollama client when provided', () => {
    const existingClient = new Ollama({
      host: 'http://existing-host:11434',
    });

    const provider = createOllama({
      client: existingClient,
    });

    expect(provider).toBeDefined();
    expect(typeof provider).toBe('function');
    expect(provider.chat).toBeDefined();
    expect(provider.embedding).toBeDefined();
  });

  it('should ignore other options when existing client is provided', () => {
    const existingClient = new Ollama({
      host: 'http://existing-host:11434',
    });

    const provider = createOllama({
      client: existingClient,
      baseURL: 'http://ignored-host:11434',
      headers: { 'X-Ignored': 'ignored-value' },
    });

    expect(provider).toBeDefined();
    // The provider should still work even though other options are ignored
    expect(typeof provider).toBe('function');
  });

  it('should work with default options', () => {
    const provider = createOllama();

    expect(provider).toBeDefined();
    expect(typeof provider).toBe('function');
    expect(provider.chat).toBeDefined();
    expect(provider.embedding).toBeDefined();
  });

  it('should create chat model with existing client', () => {
    const existingClient = new Ollama({
      host: 'http://test-host:11434',
    });

    const provider = createOllama({
      client: existingClient,
    });

    const chatModel = provider.chat('llama3.2');
    expect(chatModel).toBeDefined();
    expect(chatModel.modelId).toBe('llama3.2');
  });

  it('should create embedding model with existing client', () => {
    const existingClient = new Ollama({
      host: 'http://test-host:11434',
    });

    const provider = createOllama({
      client: existingClient,
    });

    const embeddingModel = provider.embedding('nomic-embed-text');
    expect(embeddingModel).toBeDefined();
    expect(embeddingModel.modelId).toBe('nomic-embed-text');
  });

  it('should support function call syntax with existing client', () => {
    const existingClient = new Ollama({
      host: 'http://test-host:11434',
    });

    const provider = createOllama({
      client: existingClient,
    });

    const chatModel = provider('llama3.2');
    expect(chatModel).toBeDefined();
    expect(chatModel.modelId).toBe('llama3.2');
  });
});
