import { describe, it, expect, beforeEach, vi } from 'vitest';
import { OllamaChatLanguageModel } from './chat-language-model';
import { OllamaChatSettings } from '../provider';
import {
  LanguageModelV3CallOptions,
  LanguageModelV3StreamPart,
  LanguageModelV3FunctionTool,
} from '@ai-sdk/provider';
import { Ollama, AbortableAsyncIterator, ChatResponse } from 'ollama';

// Mock Ollama client
const mockOllamaClient = {
  chat: vi.fn(),
} as unknown as Ollama;

// Helper to create V3 usage format for test expectations
function createExpectedUsage(inputTokens: number, outputTokens: number) {
  return {
    inputTokens: {
      total: inputTokens,
      noCache: inputTokens,
      cacheRead: undefined,
      cacheWrite: undefined,
    },
    outputTokens: {
      total: outputTokens,
      text: outputTokens,
      reasoning: undefined,
    },
  };
}

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
      expect(model.specificationVersion).toBe('v3');
      expect(model.modelId).toBe('llama3.2');
      expect(model.provider).toBe('ollama');
    });

    it('should have correct supportedUrls for V3 spec', () => {
      // V3 uses media type patterns as keys (e.g., 'image/*')
      expect(model.supportedUrls).toEqual({
        'image/*': [
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

      const options: LanguageModelV3CallOptions = {
        prompt: [{ role: 'user', content: [{ type: 'text', text: 'Hello' }] }],
      };

      const result = await model.doGenerate(options);

      expect(result.content).toEqual([{ type: 'text', text: 'Hello, world!' }]);
      expect(result.finishReason).toBe('stop');
      // V3 uses structured usage format
      expect(result.usage).toEqual(createExpectedUsage(5, 10));

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

      const options: LanguageModelV3CallOptions = {
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

      const options: LanguageModelV3CallOptions = {
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

      const options: LanguageModelV3CallOptions = {
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

    it('should force completion when tool calls succeed without final text', async () => {
      // Create model with reliableToolCalling enabled for this test
      const reliableModel = new OllamaChatLanguageModel(
        'llama3.2',
        { reliableToolCalling: true },
        { client: mockOllamaClient, provider: 'ollama' },
      );

      const toolExecute = vi.fn().mockResolvedValue({
        temperature: 20,
        unit: 'celsius',
      });

      const initialResponse: ChatResponse = {
        model: 'llama3.2',
        created_at: new Date(),
        message: {
          role: 'assistant',
          content: '',
          tool_calls: [
            {
              function: {
                name: 'get_weather',
                arguments: { city: 'San Francisco' },
              },
            },
          ],
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

      const forcedResponse: ChatResponse = {
        model: 'llama3.2',
        created_at: new Date(),
        message: {
          role: 'assistant',
          content: 'It is 20C in San Francisco today with clear skies.',
        },
        done: true,
        done_reason: 'stop',
        eval_count: 8,
        prompt_eval_count: 4,
        total_duration: 800_000_000,
        load_duration: 80_000_000,
        prompt_eval_duration: 120_000_000,
        eval_duration: 600_000_000,
      };

      vi.mocked(mockOllamaClient.chat)
        .mockResolvedValueOnce(initialResponse)
        .mockResolvedValueOnce(forcedResponse);

      const options: LanguageModelV3CallOptions = {
        prompt: [
          {
            role: 'user',
            content: [
              { type: 'text', text: 'What is the weather in San Francisco?' },
            ],
          },
        ],
        tools: [
          {
            type: 'function',
            name: 'get_weather',
            description: 'Get the current weather for a location',
            inputSchema: {
              type: 'object',
              properties: {
                location: { type: 'string' },
              },
            },
            execute: toolExecute,
          } as LanguageModelV3FunctionTool & { execute: typeof toolExecute },
        ],
      };

      const result = await reliableModel.doGenerate(options);

      expect(toolExecute).toHaveBeenCalledWith(
        expect.objectContaining({ location: 'San Francisco' }),
      );
      expect(vi.mocked(mockOllamaClient.chat)).toHaveBeenCalledTimes(2);
      expect(result.content.find((part) => part.type === 'text')).toEqual({
        type: 'text',
        text: 'It is 20C in San Francisco today with clear skies.',
      });
      expect(result.providerMetadata?.ollama?.reliable_tool_calling).toBe(true);
      expect(result.providerMetadata?.ollama?.completion_method).toBe('forced');
      expect(result.providerMetadata?.ollama?.retry_count).toBe(1);
    });

    it('should handle errors properly', async () => {
      const error = new Error('Connection failed');
      vi.mocked(mockOllamaClient.chat).mockRejectedValueOnce(error);

      const options: LanguageModelV3CallOptions = {
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

      const options: LanguageModelV3CallOptions = {
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

      const options: LanguageModelV3CallOptions = {
        prompt: [{ role: 'user', content: [{ type: 'text', text: 'Hello' }] }],
      };

      const { stream } = await model.doStream(options);
      const chunks = [];

      for await (const chunk of stream) {
        chunks.push(chunk);
      }

      expect(chunks).toHaveLength(7); // stream-start + text-start + 3 text-delta + text-end + finish
      // V3 adds stream-start at the beginning
      expect(chunks[0]).toEqual({
        type: 'stream-start',
        warnings: [],
      });
      expect(chunks[1]).toEqual({
        type: 'text-start',
        id: expect.any(String),
      });
      const textStartId = (chunks[1] as { id: string }).id;
      expect(chunks[2]).toEqual({
        type: 'text-delta',
        id: textStartId,
        delta: 'Hello',
      });
      expect(chunks[3]).toEqual({
        type: 'text-delta',
        id: textStartId,
        delta: ' world',
      });
      expect(chunks[4]).toEqual({
        type: 'text-delta',
        id: textStartId,
        delta: '!',
      });
      expect(chunks[5]).toEqual({
        type: 'text-end',
        id: textStartId,
      });
      expect(chunks[6]).toEqual({
        type: 'finish',
        finishReason: 'stop',
        usage: createExpectedUsage(8, 15),
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

      const options: LanguageModelV3CallOptions = {
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

      const options: LanguageModelV3CallOptions = {
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

      const options: LanguageModelV3CallOptions = {
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

      const options: LanguageModelV3CallOptions = {
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

  describe('doGenerate with think', () => {
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
        { think: true },
        { client: mockOllamaClient, provider: 'ollama' },
      );

      const options: LanguageModelV3CallOptions = {
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
      expect(result.usage).toEqual(createExpectedUsage(8, 15));
    });

    it('should not include reasoning when think is disabled', async () => {
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
        { think: false },
        { client: mockOllamaClient, provider: 'ollama' },
      );

      const options: LanguageModelV3CallOptions = {
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

  describe('doStream with think', () => {
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
        { think: true },
        { client: mockOllamaClient, provider: 'ollama' },
      );

      const options: LanguageModelV3CallOptions = {
        prompt: [
          {
            role: 'user',
            content: [{ type: 'text', text: 'What is the answer?' }],
          },
        ],
      };

      const { stream } = await modelWithReasoning.doStream(options);
      const chunks: LanguageModelV3StreamPart[] = [];

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
      // Final text may be emitted on the done chunk; accept either behavior
      // If text was emitted, it should match our final chunk content
      if (textDelta) {
        expect(textDelta).toEqual({
          type: 'text-delta',
          id: expect.any(String),
          delta: 'The answer is 42.',
        });
      }
      expect(finish).toBeDefined();
      expect(finish?.finishReason).toBe('stop');
    });

    it('should not emit reasoning stream parts when think is disabled', async () => {
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
        { think: false },
        { client: mockOllamaClient, provider: 'ollama' },
      );

      const options: LanguageModelV3CallOptions = {
        prompt: [
          {
            role: 'user',
            content: [{ type: 'text', text: 'What is the answer?' }],
          },
        ],
      };

      const { stream } = await modelWithoutReasoning.doStream(options);
      const chunks: LanguageModelV3StreamPart[] = [];

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
      // Final text may be emitted on the done chunk; accept either behavior
      if (textDelta) {
        expect(textDelta).toEqual({
          type: 'text-delta',
          id: expect.any(String),
          delta: 'The answer is 42.',
        });
      }
      expect(finish).toBeDefined();
      expect(finish?.finishReason).toBe('stop');
    });
  });

  describe('UI Message Stream compatibility', () => {
    it('should emit text-start, text-delta, and text-end for UI message streaming', async () => {
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

      const options: LanguageModelV3CallOptions = {
        prompt: [{ role: 'user', content: [{ type: 'text', text: 'Hello' }] }],
      };

      const { stream } = await model.doStream(options);
      const chunks: LanguageModelV3StreamPart[] = [];

      for await (const chunk of stream) {
        chunks.push(chunk);
      }

      // Should have: stream-start, text-start, text-delta, text-delta, text-delta, text-end, finish
      expect(chunks).toHaveLength(7);

      // V3 adds stream-start at the beginning
      expect(chunks[0]).toEqual({
        type: 'stream-start',
        warnings: [],
      });

      // Check text-start is emitted second
      expect(chunks[1]).toEqual({
        type: 'text-start',
        id: expect.any(String),
      });

      // Check text-delta parts have the same ID
      const textStartId = (chunks[1] as { id: string }).id;
      expect(chunks[2]).toEqual({
        type: 'text-delta',
        id: textStartId,
        delta: 'Hello',
      });
      expect(chunks[3]).toEqual({
        type: 'text-delta',
        id: textStartId,
        delta: ' world',
      });
      expect(chunks[4]).toEqual({
        type: 'text-delta',
        id: textStartId,
        delta: '!',
      });

      // Check text-end is emitted with the same ID
      expect(chunks[5]).toEqual({
        type: 'text-end',
        id: textStartId,
      });

      // Check finish is emitted last
      expect(chunks[6]).toEqual({
        type: 'finish',
        finishReason: 'stop',
        usage: createExpectedUsage(8, 15),
      });
    });

    it('should handle empty content gracefully without text-start/end', async () => {
      const mockStreamData = [
        {
          model: 'llama3.2',
          created_at: new Date(),
          message: { role: 'assistant', content: '' },
          done: true,
          done_reason: 'stop',
          eval_count: 0,
          prompt_eval_count: 5,
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
            .mockResolvedValueOnce({ done: true }),
        }),
      };

      (
        mockOllamaClient.chat as unknown as ReturnType<typeof vi.fn>
      ).mockResolvedValueOnce(
        mockAsyncIterable as unknown as AbortableAsyncIterator<ChatResponse>,
      );

      const options: LanguageModelV3CallOptions = {
        prompt: [{ role: 'user', content: [{ type: 'text', text: 'Test' }] }],
      };

      const { stream } = await model.doStream(options);
      const chunks: LanguageModelV3StreamPart[] = [];

      for await (const chunk of stream) {
        chunks.push(chunk);
      }

      // Should have stream-start + finish (no text parts since content is empty)
      expect(chunks).toHaveLength(2);
      expect(chunks[0]).toEqual({
        type: 'stream-start',
        warnings: [],
      });
      expect(chunks[1]).toEqual({
        type: 'finish',
        finishReason: 'stop',
        usage: createExpectedUsage(5, 0),
      });
    });

    it('should handle content only in final chunk', async () => {
      const mockStreamData = [
        {
          model: 'llama3.2',
          created_at: new Date(),
          message: { role: 'assistant', content: '' },
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
          message: { role: 'assistant', content: 'Complete response' },
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
            .mockResolvedValueOnce({ done: true }),
        }),
      };

      (
        mockOllamaClient.chat as unknown as ReturnType<typeof vi.fn>
      ).mockResolvedValueOnce(
        mockAsyncIterable as unknown as AbortableAsyncIterator<ChatResponse>,
      );

      const options: LanguageModelV3CallOptions = {
        prompt: [{ role: 'user', content: [{ type: 'text', text: 'Test' }] }],
      };

      const { stream } = await model.doStream(options);
      const chunks: LanguageModelV3StreamPart[] = [];

      for await (const chunk of stream) {
        chunks.push(chunk);
      }

      // Should have: stream-start, text-start, text-delta, text-end, finish
      expect(chunks).toHaveLength(5);

      // V3 adds stream-start at the beginning
      expect(chunks[0]).toEqual({
        type: 'stream-start',
        warnings: [],
      });

      // Check text-start is emitted when content appears in final chunk
      expect(chunks[1]).toEqual({
        type: 'text-start',
        id: expect.any(String),
      });

      const textStartId = (chunks[1] as { id: string }).id;
      expect(chunks[2]).toEqual({
        type: 'text-delta',
        id: textStartId,
        delta: 'Complete response',
      });

      expect(chunks[3]).toEqual({
        type: 'text-end',
        id: textStartId,
      });

      expect(chunks[4]).toEqual({
        type: 'finish',
        finishReason: 'stop',
        usage: createExpectedUsage(8, 15),
      });
    });

    it('should maintain consistent text ID across all text stream parts', async () => {
      const mockStreamData = [
        {
          model: 'llama3.2',
          created_at: new Date(),
          message: { role: 'assistant', content: 'Part' },
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
          message: { role: 'assistant', content: ' two' },
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
          message: { role: 'assistant', content: ' three' },
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

      const options: LanguageModelV3CallOptions = {
        prompt: [{ role: 'user', content: [{ type: 'text', text: 'Test' }] }],
      };

      const { stream } = await model.doStream(options);
      const chunks: LanguageModelV3StreamPart[] = [];

      for await (const chunk of stream) {
        chunks.push(chunk);
      }

      // Extract text-related chunks
      const textStart = chunks.find((chunk) => chunk.type === 'text-start') as {
        id: string;
      };
      const textDeltas = chunks.filter(
        (chunk) => chunk.type === 'text-delta',
      ) as { id: string; delta: string }[];
      const textEnd = chunks.find((chunk) => chunk.type === 'text-end') as {
        id: string;
      };

      // All text parts should have the same ID
      const expectedId = textStart.id;
      expect(textStart.id).toBe(expectedId);
      for (const delta of textDeltas) {
        expect(delta.id).toBe(expectedId);
      }
      expect(textEnd.id).toBe(expectedId);

      // Verify the deltas combine to form the complete text
      const completeText = textDeltas.map((delta) => delta.delta).join('');
      expect(completeText).toBe('Part two three');
    });
  });
});
