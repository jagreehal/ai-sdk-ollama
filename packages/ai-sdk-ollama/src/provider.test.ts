import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Ollama } from 'ollama';
import { createOllama } from './provider';

// Mock the ollama module to capture constructor calls
type OllamaConfig = { headers?: Record<string, string> | Headers | [string, string][] };

// Augment globalThis with proper typing to store captured configs
// This avoids 'as any' while working around vi.mock hoisting
declare global {
  // eslint-disable-next-line no-var
  var __capturedOllamaConfigs: OllamaConfig[];
}

vi.mock('ollama', async () => {
  const actual = await vi.importActual<typeof import('ollama')>('ollama');
  return {
    ...actual,
    Ollama: class MockOllama extends actual.Ollama {
      constructor(config?: OllamaConfig) {
        globalThis.__capturedOllamaConfigs = globalThis.__capturedOllamaConfigs ?? [];
        globalThis.__capturedOllamaConfigs.push(config ?? {});
        super(config);
      }
    },
  };
});

describe('createOllama', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    globalThis.__capturedOllamaConfigs = [];
  });

  function getCapturedConfigs(): OllamaConfig[] {
    return globalThis.__capturedOllamaConfigs ?? [];
  }

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

  it('should set Authorization header when apiKey is provided', () => {
    const provider = createOllama({
      apiKey: 'test-api-key-123',
      baseURL: 'http://test-host:11434',
    });

    expect(provider).toBeDefined();
    expect(typeof provider).toBe('function');
    const configs = getCapturedConfigs();
    expect(configs.length).toBeGreaterThan(0);
    const config = configs.at(-1);
    expect(config).toBeDefined();
    expect(config?.headers).toBeDefined();
    const headers = config?.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer test-api-key-123');
  });

  it('should not override existing Authorization header', () => {
    const provider = createOllama({
      apiKey: 'test-api-key-123',
      headers: {
        Authorization: 'Bearer existing-key',
      },
      baseURL: 'http://test-host:11434',
    });

    expect(provider).toBeDefined();
    expect(typeof provider).toBe('function');
    const configs = getCapturedConfigs();
    expect(configs.length).toBeGreaterThan(0);
    const config = configs.at(-1);
    expect(config).toBeDefined();
    expect(config?.headers).toBeDefined();
    const headers = config?.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer existing-key');
  });

  it('should handle Headers instance correctly', () => {
    // Check if Headers is available (Node.js 18+)
    if (typeof Headers === 'undefined') {
      // Skip test if Headers is not available
      return;
    }

    const headersInstance = new Headers();
    headersInstance.set('X-Custom', 'custom-value');

    const provider = createOllama({
      apiKey: 'test-api-key-456',
      headers: headersInstance,
      baseURL: 'http://test-host:11434',
    });

    expect(provider).toBeDefined();
    const configs = getCapturedConfigs();
    expect(configs.length).toBeGreaterThan(0);
    const config = configs.at(-1);
    expect(config).toBeDefined();

    // Headers should be normalized to a plain object by normalizeHeaders
    expect(config?.headers).toBeDefined();

    // After normalization, headers should be a plain object (not Headers instance or array)
    const headers = config?.headers;
    expect(headers).not.toBeInstanceOf(Headers);
    expect(Array.isArray(headers)).toBe(false);

    // Verify as plain object
    // Note: Headers API lowercases all header names, and our normalizeHeaders
    // adds Authorization with capital A, so we check for both cases
    const plainHeaders = headers as Record<string, string>;
    expect(plainHeaders.Authorization).toBe('Bearer test-api-key-456');
    // Headers API stores keys in lowercase
    expect(plainHeaders['x-custom']).toBe('custom-value');
  });

  it('should handle array headers correctly', () => {
    const arrayHeaders: [string, string][] = [
      ['X-Custom', 'custom-value'],
      ['X-Another', 'another-value'],
    ];

    const provider = createOllama({
      apiKey: 'test-api-key-789',
      headers: arrayHeaders,
      baseURL: 'http://test-host:11434',
    });

    expect(provider).toBeDefined();
    const configs = getCapturedConfigs();
    expect(configs.length).toBeGreaterThan(0);
    const config = configs.at(-1);
    expect(config).toBeDefined();
    expect(config?.headers).toBeDefined();
    const headers = config?.headers as Record<string, string>;
    expect(headers['X-Custom']).toBe('custom-value');
    expect(headers['X-Another']).toBe('another-value');
    expect(headers.Authorization).toBe('Bearer test-api-key-789');
  });
});
