import { describe, it, expect, beforeEach, vi } from 'vitest';
import { OllamaChatLanguageModel } from './chat-language-model';
import { OllamaChatSettings } from '../provider';
import { LanguageModelV2CallOptions } from '@ai-sdk/provider';
import { Ollama } from 'ollama';

// Mock Ollama client
const mockOllamaClient = {
  chat: vi.fn(),
} as unknown as Ollama;

describe('OllamaChatLanguageModel', () => {
  let model: OllamaChatLanguageModel;
  let settings: OllamaChatSettings;

  beforeEach(() => {
    vi.clearAllMocks();
    settings = {};
    model = new OllamaChatLanguageModel('llama3.2', settings, {
      client: mockOllamaClient,
      provider: 'ollama',
    });
  });

  describe('initialization', () => {
    it('should initialize with correct properties', () => {
      expect(model.specificationVersion).toBe('v2');
      expect(model.modelId).toBe('llama3.2');
      expect(model.provider).toBe('ollama');
      expect(model.defaultObjectGenerationMode).toBe('json');
    });

    it('should have correct capability flags', () => {
      expect(model.supportsImages).toBe(false);
      expect(model.supportsVideoURLs).toBe(false);
      expect(model.supportsAudioURLs).toBe(false);
      expect(model.supportsVideoFile).toBe(false);
      expect(model.supportsAudioFile).toBe(false);
      expect(model.supportsImageFile).toBe(true);
      expect(model.supportedUrls).toEqual({});
    });

    it('should respect structured outputs setting', () => {
      const modelWithStructuredOutputs = new OllamaChatLanguageModel(
        'llama3.2',
        { structuredOutputs: true },
        { client: mockOllamaClient, provider: 'ollama' },
      );

      expect(modelWithStructuredOutputs.supportsStructuredOutputs).toBe(true);
    });
  });

  describe('doGenerate', () => {
    it('should handle simple text generation', async () => {
      const mockResponse = {
        message: {
          role: 'assistant',
          content: 'Hello, world!',
        },
        done: true,
        done_reason: 'stop',
        eval_count: 10,
        prompt_eval_count: 5,
        total_duration: 1_000_000_000,
        load_duration: 100_000_000,
        prompt_eval_duration: 200_000_000,
        eval_duration: 700_000_000,
      };

      vi.mocked(mockOllamaClient.chat).mockResolvedValueOnce(mockResponse);

      const options: LanguageModelV2CallOptions = {
        inputFormat: 'prompt',
        prompt: [{ role: 'user', content: 'Hello' }],
        maxRetries: 0,
      };

      const result = await model.doGenerate(options);

      expect(result.content).toEqual([{ type: 'text', text: 'Hello, world!' }]);
      expect(result.finishReason).toBe('stop');
      expect(result.usage).toEqual({
        inputTokens: 5,
        outputTokens: 10,
        totalTokens: 15,
      });

      expect(mockOllamaClient.chat).toHaveBeenCalledWith({
        model: 'llama3.2',
        messages: [{ role: 'user', content: 'Hello' }],
        stream: false,
        options: expect.any(Object),
      });
    });

    it('should handle generation with options', async () => {
      const mockResponse = {
        message: {
          role: 'assistant',
          content: 'Response with options',
        },
        done: true,
        done_reason: 'stop',
        eval_count: 15,
        prompt_eval_count: 8,
      };

      vi.mocked(mockOllamaClient.chat).mockResolvedValueOnce(mockResponse);

      const options: LanguageModelV2CallOptions = {
        inputFormat: 'prompt',
        prompt: [{ role: 'user', content: 'Test' }],
        temperature: 0.7,
        maxOutputTokens: 100,
        topP: 0.9,
        topK: 50,
        seed: 42,
        stopSequences: ['STOP'],
        maxRetries: 0,
      };

      const result = await model.doGenerate(options);

      expect(result.content).toEqual([
        { type: 'text', text: 'Response with options' },
      ]);
      expect(mockOllamaClient.chat).toHaveBeenCalledWith({
        model: 'llama3.2',
        messages: [{ role: 'user', content: 'Test' }],
        stream: false,
        options: expect.objectContaining({
          temperature: 0.7,
          num_predict: 100,
          top_p: 0.9,
          top_k: 50,
          seed: 42,
          stop: ['STOP'],
        }),
      });
    });

    it('should handle JSON response format', async () => {
      const mockResponse = {
        message: {
          role: 'assistant',
          content: '{"name": "John", "age": 30}',
        },
        done: true,
        done_reason: 'stop',
        eval_count: 20,
        prompt_eval_count: 10,
      };

      vi.mocked(mockOllamaClient.chat).mockResolvedValueOnce(mockResponse);

      const options: LanguageModelV2CallOptions = {
        inputFormat: 'prompt',
        prompt: [{ role: 'user', content: 'Generate JSON' }],
        responseFormat: { type: 'json' },
        maxRetries: 0,
      };

      const result = await model.doGenerate(options);

      expect(result.content).toEqual([
        { type: 'text', text: '{"name": "John", "age": 30}' },
      ]);
      expect(mockOllamaClient.chat).toHaveBeenCalledWith({
        model: 'llama3.2',
        messages: [{ role: 'user', content: 'Generate JSON' }],
        stream: false,
        format: 'json',
        options: expect.any(Object),
      });
    });

    it('should handle tool calling with supported models', async () => {
      const mockResponse = {
        message: {
          role: 'assistant',
          content: 'Response',
        },
        done: true,
        done_reason: 'stop',
        eval_count: 10,
        prompt_eval_count: 5,
      };

      vi.mocked(mockOllamaClient.chat).mockResolvedValueOnce(mockResponse);

      const options: LanguageModelV2CallOptions = {
        inputFormat: 'prompt',
        prompt: [{ role: 'user', content: 'Test' }],
        tools: [
          {
            type: 'function',
            name: 'test_tool',
            description: 'A test tool',
            parameters: {
              type: 'object',
              properties: {
                param: { type: 'string' },
              },
            },
          },
        ],
        maxRetries: 0,
      };

      const result = await model.doGenerate(options);

      // Tool calling is now supported for llama3.2, so no warnings should be generated
      expect(result.warnings).toHaveLength(0);
      // Verify tools were passed to Ollama
      expect(vi.mocked(mockOllamaClient.chat)).toHaveBeenCalledWith(
        expect.objectContaining({
          tools: expect.arrayContaining([
            expect.objectContaining({
              type: 'function',
              function: expect.objectContaining({
                name: 'test_tool',
                description: 'A test tool',
              }),
            }),
          ]),
        })
      );
    });

    it('should throw error for unsupported models', async () => {
      // Use a model that doesn't support tool calling
      const unsupportedModel = new OllamaChatLanguageModel(
        'llama3', // Legacy model without tool support
        {},
        { client: mockOllamaClient, provider: 'ollama' },
      );

      const options: LanguageModelV2CallOptions = {
        inputFormat: 'prompt',
        prompt: [{ role: 'user', content: 'Test with tools' }],
        tools: [
          {
            type: 'function',
            name: 'test_tool',
            description: 'A test tool',
            parameters: {
              type: 'object',
              properties: {
                param: { type: 'string' },
              },
            },
          },
        ],
        maxRetries: 0,
      };

      // Should throw error for unsupported tool calling
      await expect(unsupportedModel.doGenerate(options)).rejects.toThrow(
        /does not support tool calling/
      );
      
      // Verify Ollama.chat was NOT called (error thrown before)
      expect(vi.mocked(mockOllamaClient.chat)).not.toHaveBeenCalled();
    });

    it('should handle errors properly', async () => {
      const error = new Error('Connection failed');
      vi.mocked(mockOllamaClient.chat).mockRejectedValueOnce(error);

      const options: LanguageModelV2CallOptions = {
        inputFormat: 'prompt',
        prompt: [{ role: 'user', content: 'Hello' }],
        maxRetries: 0,
      };

      await expect(model.doGenerate(options)).rejects.toThrow(
        'Connection failed',
      );
    });

    it('should handle length finish reason', async () => {
      const mockResponse = {
        message: {
          role: 'assistant',
          content: 'Truncated response',
        },
        done: true,
        done_reason: 'length',
        eval_count: 100,
        prompt_eval_count: 10,
      };

      vi.mocked(mockOllamaClient.chat).mockResolvedValueOnce(mockResponse);

      const options: LanguageModelV2CallOptions = {
        inputFormat: 'prompt',
        prompt: [{ role: 'user', content: 'Write a long story' }],
        maxRetries: 0,
      };

      const result = await model.doGenerate(options);

      expect(result.finishReason).toBe('length');
    });
  });

  describe('doStream', () => {
    it('should handle streaming responses', async () => {
      const mockStreamData = [
        {
          message: { role: 'assistant', content: 'Hello' },
          done: false,
        },
        {
          message: { role: 'assistant', content: ' world' },
          done: false,
        },
        {
          message: { role: 'assistant', content: '!' },
          done: true,
          done_reason: 'stop',
          eval_count: 15,
          prompt_eval_count: 8,
        },
      ];

      const mockAsyncIterable = {
        [Symbol.asyncIterator]: vi.fn().mockReturnValue({
          next: vi
            .fn()
            .mockResolvedValueOnce({ value: mockStreamData[0], done: false })
            .mockResolvedValueOnce({ value: mockStreamData[1], done: false })
            .mockResolvedValueOnce({ value: mockStreamData[2], done: false })
            .mockResolvedValueOnce({ done: true }),
        }),
      };

      vi.mocked(mockOllamaClient.chat).mockResolvedValueOnce(
        mockAsyncIterable as AsyncIterable<ChatResponse>,
      );

      const options: LanguageModelV2CallOptions = {
        inputFormat: 'prompt',
        prompt: [{ role: 'user', content: 'Hello' }],
        maxRetries: 0,
      };

      const { stream } = await model.doStream(options);
      const chunks = [];

      for await (const chunk of stream) {
        chunks.push(chunk);
      }

      expect(chunks).toHaveLength(3); // 2 text chunks + 1 finish chunk
      expect(chunks[0]).toEqual({
        type: 'text-delta',
        id: expect.any(String),
        delta: 'Hello',
      });
      expect(chunks[1]).toEqual({
        type: 'text-delta',
        id: expect.any(String),
        delta: ' world',
      });
      expect(chunks[2]).toEqual({
        type: 'finish',
        finishReason: 'stop',
        usage: {
          inputTokens: 8,
          outputTokens: 15,
          totalTokens: 23,
        },
      });

      expect(mockOllamaClient.chat).toHaveBeenCalledWith({
        model: 'llama3.2',
        messages: [{ role: 'user', content: 'Hello' }],
        stream: true,
        options: expect.any(Object),
      });
    });

    it('should handle streaming errors', async () => {
      const error = new Error('Stream error');
      vi.mocked(mockOllamaClient.chat).mockRejectedValueOnce(error);

      const options: LanguageModelV2CallOptions = {
        inputFormat: 'prompt',
        prompt: [{ role: 'user', content: 'Hello' }],
        maxRetries: 0,
      };

      await expect(model.doStream(options)).rejects.toThrow('Stream error');
    });

    it('should handle abort signal in streaming', async () => {
      const abortController = new AbortController();
      const mockAsyncIterable = {
        [Symbol.asyncIterator]: vi.fn().mockReturnValue({
          next: vi.fn().mockImplementation(async () => {
            abortController.abort();
            throw new Error('Aborted');
          }),
        }),
      };

      vi.mocked(mockOllamaClient.chat).mockResolvedValueOnce(
        mockAsyncIterable as AsyncIterable<ChatResponse>,
      );

      const options: LanguageModelV2CallOptions = {
        inputFormat: 'prompt',
        prompt: [{ role: 'user', content: 'Hello' }],
        abortSignal: abortController.signal,
        maxRetries: 0,
      };

      const { stream } = await model.doStream(options);

      await expect(async () => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        for await (const _chunk of stream) {
          // Should throw before getting here
        }
      }).rejects.toThrow('Aborted');
    });
  });

  describe('with custom settings', () => {
    it('should use custom Ollama options', async () => {
      const customSettings: OllamaChatSettings = {
        options: {
          num_ctx: 4096,
          num_gpu: 2,
          temperature: 0.8,
          mirostat: 1,
          mirostat_eta: 0.1,
          mirostat_tau: 5,
        },
      };

      const customModel = new OllamaChatLanguageModel(
        'custom-model',
        customSettings,
        { client: mockOllamaClient, provider: 'ollama' },
      );

      const mockResponse = {
        message: {
          role: 'assistant',
          content: 'Custom response',
        },
        done: true,
        done_reason: 'stop',
        eval_count: 10,
        prompt_eval_count: 5,
      };

      vi.mocked(mockOllamaClient.chat).mockResolvedValueOnce(mockResponse);

      const options: LanguageModelV2CallOptions = {
        inputFormat: 'prompt',
        prompt: [{ role: 'user', content: 'Test' }],
        maxRetries: 0,
      };

      await customModel.doGenerate(options);

      expect(mockOllamaClient.chat).toHaveBeenCalledWith({
        model: 'custom-model',
        messages: [{ role: 'user', content: 'Test' }],
        stream: false,
        format: undefined,
        options: expect.objectContaining({
          num_ctx: 4096,
          num_gpu: 2,
          mirostat: 1,
          mirostat_eta: 0.1,
          mirostat_tau: 5,
        }),
      });
    });

    it('should let Ollama settings override AI SDK call options', async () => {
      const settingsWithDefaults: OllamaChatSettings = {
        options: {
          temperature: 0.5, // Ollama option should win
          top_k: 40,        // Ollama option should win
        },
      };

      const modelWithDefaults = new OllamaChatLanguageModel(
        'test-model',
        settingsWithDefaults,
        { client: mockOllamaClient, provider: 'ollama' },
      );

      const mockResponse = {
        message: {
          role: 'assistant',
          content: 'Response',
        },
        done: true,
        done_reason: 'stop',
        eval_count: 10,
        prompt_eval_count: 5,
      };

      vi.mocked(mockOllamaClient.chat).mockResolvedValueOnce(mockResponse);

      const options: LanguageModelV2CallOptions = {
        inputFormat: 'prompt',
        prompt: [{ role: 'user', content: 'Test' }],
        temperature: 0.9, // Will be overridden by Ollama setting
        topK: 60,        // Will be overridden by Ollama setting
        maxRetries: 0,
      };

      await modelWithDefaults.doGenerate(options);

      expect(mockOllamaClient.chat).toHaveBeenCalledWith({
        model: 'test-model',
        messages: [{ role: 'user', content: 'Test' }],
        stream: false,
        options: expect.objectContaining({
          temperature: 0.5, // Ollama setting wins
          top_k: 40,        // Ollama setting wins
        }),
      });
    });
  });
});
