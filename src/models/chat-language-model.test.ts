import { describe, it, expect, beforeEach, vi } from 'vitest';
import { OllamaChatLanguageModel } from './chat-language-model';
import { OllamaChatSettings } from '../provider';
import {
  LanguageModelV2CallOptions,
  LanguageModelV2StreamPart,
} from '@ai-sdk/provider';
import { Ollama, AbortableAsyncIterator, ChatResponse } from 'ollama';

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
      expect(model.supportsImages).toBe(true); // ✅ Ollama supports images
      expect(model.supportsVideoURLs).toBe(false);
      expect(model.supportsAudioURLs).toBe(false);
      expect(model.supportsVideoFile).toBe(false);
      expect(model.supportsAudioFile).toBe(false);
      expect(model.supportsImageFile).toBe(true);
      expect(model.supportedUrls).toEqual({
        image: [
          /^https?:\/\/.*\.(jpg|jpeg|png|gif|webp|bmp|svg)(\?.*)?$/i,
          /^data:image\/[^;]+;base64,/i,
        ],
      });
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
        model: 'llama3.2',
        created_at: new Date(),
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
        prompt: [{ role: 'user', content: [{ type: 'text', text: 'Hello' }] }],
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
        model: 'llama3.2',
        created_at: new Date(),
        message: {
          role: 'assistant',
          content: 'Response with options',
        },
        done: true,
        done_reason: 'stop',
        eval_count: 15,
        prompt_eval_count: 8,
        total_duration: 1_000_000_000,
        load_duration: 100_000_000,
        prompt_eval_duration: 200_000_000,
        eval_duration: 700_000_000,
      };

      vi.mocked(mockOllamaClient.chat).mockResolvedValueOnce(mockResponse);

      const options: LanguageModelV2CallOptions = {
        prompt: [{ role: 'user', content: [{ type: 'text', text: 'Test' }] }],
        temperature: 0.7,
        maxOutputTokens: 100,
        topP: 0.9,
        topK: 50,
        seed: 42,
        stopSequences: ['STOP'],
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
        model: 'llama3.2',
        created_at: new Date(),
        message: {
          role: 'assistant',
          content: '{"name": "John", "age": 30}',
        },
        done: true,
        done_reason: 'stop',
        eval_count: 20,
        prompt_eval_count: 10,
        total_duration: 1_000_000_000,
        load_duration: 100_000_000,
        prompt_eval_duration: 200_000_000,
        eval_duration: 700_000_000,
      };

      vi.mocked(mockOllamaClient.chat).mockResolvedValueOnce(mockResponse);

      const options: LanguageModelV2CallOptions = {
        prompt: [
          { role: 'user', content: [{ type: 'text', text: 'Generate JSON' }] },
        ],
        responseFormat: { type: 'json' },
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
        model: 'llama3.2',
        created_at: new Date(),
        message: {
          role: 'assistant',
          content: 'Response',
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
        prompt: [{ role: 'user', content: [{ type: 'text', text: 'Test' }] }],
        tools: [
          {
            type: 'function',
            name: 'test_tool',
            description: 'A test tool',
            inputSchema: {
              type: 'object',
              properties: {
                param: { type: 'string' },
              },
            },
          },
        ],
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
        }),
      );
    });

    it('should handle errors properly', async () => {
      const error = new Error('Connection failed');
      vi.mocked(mockOllamaClient.chat).mockRejectedValueOnce(error);

      const options: LanguageModelV2CallOptions = {
        prompt: [{ role: 'user', content: [{ type: 'text', text: 'Hello' }] }],
      };

      await expect(model.doGenerate(options)).rejects.toThrow(
        'Connection failed',
      );
    });

    it('should handle length finish reason', async () => {
      const mockResponse = {
        model: 'llama3.2',
        created_at: new Date(),
        message: {
          role: 'assistant',
          content: 'Truncated response',
        },
        done: true,
        done_reason: 'length',
        eval_count: 100,
        prompt_eval_count: 10,
        total_duration: 1_000_000_000,
        load_duration: 100_000_000,
        prompt_eval_duration: 200_000_000,
        eval_duration: 700_000_000,
      };

      vi.mocked(mockOllamaClient.chat).mockResolvedValueOnce(mockResponse);

      const options: LanguageModelV2CallOptions = {
        prompt: [
          {
            role: 'user',
            content: [{ type: 'text', text: 'Write a long story' }],
          },
        ],
      };

      const result = await model.doGenerate(options);

      expect(result.finishReason).toBe('length');
    });
  });

  describe('doStream', () => {
    it('should handle streaming responses', async () => {
      const mockStreamData = [
        {
          model: 'llama3.2',
          created_at: new Date(),
          message: { role: 'assistant', content: 'Hello' },
          done: false,
          done_reason: '',
          eval_count: 5,
          prompt_eval_count: 3,
          total_duration: 500_000_000,
          load_duration: 50_000_000,
          prompt_eval_duration: 100_000_000,
          eval_duration: 350_000_000,
        },
        {
          model: 'llama3.2',
          created_at: new Date(),
          message: { role: 'assistant', content: ' world' },
          done: false,
          done_reason: '',
          eval_count: 10,
          prompt_eval_count: 3,
          total_duration: 800_000_000,
          load_duration: 50_000_000,
          prompt_eval_duration: 100_000_000,
          eval_duration: 650_000_000,
        },
        {
          model: 'llama3.2',
          created_at: new Date(),
          message: { role: 'assistant', content: '!' },
          done: true,
          done_reason: 'stop',
          eval_count: 15,
          prompt_eval_count: 8,
          total_duration: 1_000_000_000,
          load_duration: 100_000_000,
          prompt_eval_duration: 200_000_000,
          eval_duration: 700_000_000,
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

      (
        mockOllamaClient.chat as unknown as ReturnType<typeof vi.fn>
      ).mockResolvedValueOnce(
        mockAsyncIterable as unknown as AbortableAsyncIterator<ChatResponse>,
      );

      const options: LanguageModelV2CallOptions = {
        prompt: [{ role: 'user', content: [{ type: 'text', text: 'Hello' }] }],
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
        options: expect.objectContaining({}),
      });
    });

    it('should handle streaming errors', async () => {
      const error = new Error('Stream error');
      vi.mocked(mockOllamaClient.chat).mockRejectedValueOnce(error);

      const options: LanguageModelV2CallOptions = {
        prompt: [{ role: 'user', content: [{ type: 'text', text: 'Hello' }] }],
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

      (
        mockOllamaClient.chat as unknown as ReturnType<typeof vi.fn>
      ).mockResolvedValueOnce(
        mockAsyncIterable as unknown as AbortableAsyncIterator<ChatResponse>,
      );

      const options: LanguageModelV2CallOptions = {
        prompt: [{ role: 'user', content: [{ type: 'text', text: 'Hello' }] }],
        abortSignal: abortController.signal,
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
        model: 'custom-model',
        created_at: new Date(),
        message: {
          role: 'assistant',
          content: 'Custom response',
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
        prompt: [{ role: 'user', content: [{ type: 'text', text: 'Test' }] }],
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
          top_k: 40, // Ollama option should win
        },
      };

      const modelWithDefaults = new OllamaChatLanguageModel(
        'test-model',
        settingsWithDefaults,
        { client: mockOllamaClient, provider: 'ollama' },
      );

      const mockResponse = {
        model: 'test-model',
        created_at: new Date(),
        message: {
          role: 'assistant',
          content: 'Response',
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
        prompt: [{ role: 'user', content: [{ type: 'text', text: 'Test' }] }],
        temperature: 0.9, // Will be overridden by Ollama setting
        topK: 60, // Will be overridden by Ollama setting
      };

      await modelWithDefaults.doGenerate(options);

      expect(mockOllamaClient.chat).toHaveBeenCalledWith({
        model: 'test-model',
        messages: [{ role: 'user', content: 'Test' }],
        stream: false,
        options: expect.objectContaining({
          temperature: 0.5, // Ollama setting wins
          top_k: 40, // Ollama setting wins
        }),
      });
    });
  });

  describe('doGenerate with reasoning', () => {
    it('should handle generation with reasoning', async () => {
      const mockResponse = {
        model: 'llama3.2',
        created_at: new Date(),
        message: {
          role: 'assistant',
          content: 'The answer is 42.',
          thinking:
            'Let me think about this step by step. First, I need to understand the question. Then I can provide a logical answer.',
        },
        done: true,
        done_reason: 'stop',
        eval_count: 15,
        prompt_eval_count: 8,
        total_duration: 1_000_000_000,
        load_duration: 100_000_000,
        prompt_eval_duration: 200_000_000,
        eval_duration: 700_000_000,
      };

      vi.mocked(mockOllamaClient.chat).mockResolvedValueOnce(mockResponse);

      const modelWithReasoning = new OllamaChatLanguageModel(
        'llama3.2',
        { reasoning: true },
        { client: mockOllamaClient, provider: 'ollama' },
      );

      const options: LanguageModelV2CallOptions = {
        prompt: [
          {
            role: 'user',
            content: [{ type: 'text', text: 'What is the answer?' }],
          },
        ],
      };

      const result = await modelWithReasoning.doGenerate(options);

      expect(result.content).toEqual([
        {
          type: 'reasoning',
          text: 'Let me think about this step by step. First, I need to understand the question. Then I can provide a logical answer.',
        },
        { type: 'text', text: 'The answer is 42.' },
      ]);
      expect(result.finishReason).toBe('stop');
      expect(result.usage).toEqual({
        inputTokens: 8,
        outputTokens: 15,
        totalTokens: 23,
      });
    });

    it('should not include reasoning when reasoning is disabled', async () => {
      const mockResponse = {
        model: 'llama3.2',
        created_at: new Date(),
        message: {
          role: 'assistant',
          content: 'The answer is 42.',
          thinking: 'Let me think about this step by step.',
        },
        done: true,
        done_reason: 'stop',
        eval_count: 15,
        prompt_eval_count: 8,
        total_duration: 1_000_000_000,
        load_duration: 100_000_000,
        prompt_eval_duration: 200_000_000,
        eval_duration: 700_000_000,
      };

      vi.mocked(mockOllamaClient.chat).mockResolvedValueOnce(mockResponse);

      const modelWithoutReasoning = new OllamaChatLanguageModel(
        'llama3.2',
        { reasoning: false },
        { client: mockOllamaClient, provider: 'ollama' },
      );

      const options: LanguageModelV2CallOptions = {
        prompt: [
          {
            role: 'user',
            content: [{ type: 'text', text: 'What is the answer?' }],
          },
        ],
      };

      const result = await modelWithoutReasoning.doGenerate(options);

      expect(result.content).toEqual([
        { type: 'text', text: 'The answer is 42.' },
      ]);
      expect(result.finishReason).toBe('stop');
    });
  });

  describe('doStream with reasoning', () => {
    it('should handle streaming with reasoning', async () => {
      const mockStreamData: ChatResponse[] = [
        {
          model: 'llama3.2',
          created_at: new Date(),
          message: {
            role: 'assistant',
            content: '',
            thinking: 'Let me think about this step by step.',
          },
          done: false,
          done_reason: 'stop',
          eval_count: 5,
          prompt_eval_count: 3,
          total_duration: 500_000_000,
          load_duration: 50_000_000,
          prompt_eval_duration: 100_000_000,
          eval_duration: 350_000_000,
        },
        {
          model: 'llama3.2',
          created_at: new Date(),
          message: {
            role: 'assistant',
            content: 'The answer is 42.',
            thinking: '',
          },
          done: true,
          done_reason: 'stop',
          eval_count: 10,
          prompt_eval_count: 3,
          total_duration: 1_000_000_000,
          load_duration: 50_000_000,
          prompt_eval_duration: 100_000_000,
          eval_duration: 850_000_000,
        },
      ];

      const mockAsyncIterable = {
        [Symbol.asyncIterator]: vi.fn().mockReturnValue({
          next: vi
            .fn()
            .mockResolvedValueOnce({ value: mockStreamData[0], done: false })
            .mockResolvedValueOnce({ value: mockStreamData[1], done: false })
            .mockResolvedValueOnce({ done: true }),
        }),
      };

      (
        mockOllamaClient.chat as unknown as ReturnType<typeof vi.fn>
      ).mockResolvedValueOnce(
        mockAsyncIterable as unknown as AbortableAsyncIterator<ChatResponse>,
      );

      const modelWithReasoning = new OllamaChatLanguageModel(
        'llama3.2',
        { reasoning: true },
        { client: mockOllamaClient, provider: 'ollama' },
      );

      const options: LanguageModelV2CallOptions = {
        prompt: [
          {
            role: 'user',
            content: [{ type: 'text', text: 'What is the answer?' }],
          },
        ],
      };

      const { stream } = await modelWithReasoning.doStream(options);
      const chunks: LanguageModelV2StreamPart[] = [];

      for await (const chunk of stream) {
        chunks.push(chunk);
      }

      // Check that reasoning stream parts are emitted
      const reasoningStart = chunks.find(
        (part) => part.type === 'reasoning-start',
      );
      const reasoningDelta = chunks.find(
        (part) => part.type === 'reasoning-delta',
      );
      const reasoningEnd = chunks.find((part) => part.type === 'reasoning-end');
      const textDelta = chunks.find((part) => part.type === 'text-delta');
      const finish = chunks.find((part) => part.type === 'finish');

      expect(reasoningStart).toBeDefined();
      expect(reasoningDelta).toBeDefined();
      expect(reasoningDelta?.delta).toBe(
        'Let me think about this step by step.',
      );
      expect(reasoningEnd).toBeDefined();
      // Note: Text content is not emitted in this test because the mock data has empty content in first chunk
      // and the second chunk is the final chunk with done: true, so only finish is emitted
      expect(textDelta).toBeUndefined();
      expect(finish).toBeDefined();
      expect(finish?.finishReason).toBe('stop');
    });

    it('should not emit reasoning stream parts when reasoning is disabled', async () => {
      const mockStreamData: ChatResponse[] = [
        {
          model: 'llama3.2',
          created_at: new Date(),
          message: {
            role: 'assistant',
            content: 'The answer is 42.',
            thinking: 'Let me think about this step by step.',
          },
          done: true,
          done_reason: 'stop',
          eval_count: 10,
          prompt_eval_count: 3,
          total_duration: 1_000_000_000,
          load_duration: 50_000_000,
          prompt_eval_duration: 100_000_000,
          eval_duration: 850_000_000,
        },
      ];

      const mockAsyncIterable = {
        [Symbol.asyncIterator]: vi.fn().mockReturnValue({
          next: vi
            .fn()
            .mockResolvedValueOnce({ value: mockStreamData[0], done: false })
            .mockResolvedValueOnce({ done: true }),
        }),
      };

      (
        mockOllamaClient.chat as unknown as ReturnType<typeof vi.fn>
      ).mockResolvedValueOnce(
        mockAsyncIterable as unknown as AbortableAsyncIterator<ChatResponse>,
      );

      const modelWithoutReasoning = new OllamaChatLanguageModel(
        'llama3.2',
        { reasoning: false },
        { client: mockOllamaClient, provider: 'ollama' },
      );

      const options: LanguageModelV2CallOptions = {
        prompt: [
          {
            role: 'user',
            content: [{ type: 'text', text: 'What is the answer?' }],
          },
        ],
      };

      const { stream } = await modelWithoutReasoning.doStream(options);
      const chunks: LanguageModelV2StreamPart[] = [];

      for await (const chunk of stream) {
        chunks.push(chunk);
      }

      // Check that reasoning stream parts are NOT emitted
      const reasoningStart = chunks.find(
        (part) => part.type === 'reasoning-start',
      );
      const reasoningDelta = chunks.find(
        (part) => part.type === 'reasoning-delta',
      );
      const reasoningEnd = chunks.find((part) => part.type === 'reasoning-end');
      const textDelta = chunks.find((part) => part.type === 'text-delta');
      const finish = chunks.find((part) => part.type === 'finish');

      expect(reasoningStart).toBeUndefined();
      expect(reasoningDelta).toBeUndefined();
      expect(reasoningEnd).toBeUndefined();
      // Note: Text content is not emitted because this is a single chunk with done: true
      expect(textDelta).toBeUndefined();
      expect(finish).toBeDefined();
      expect(finish?.finishReason).toBe('stop');
    });
  });
});
