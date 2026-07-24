import { describe, it, expect, beforeEach, vi } from 'vitest';
import { OllamaChatLanguageModel } from './chat-language-model';
import {
  LanguageModelV4CallOptions,
  LanguageModelV4FunctionTool,
} from '@ai-sdk/provider';
import { ChatResponse } from 'ollama';
import { OllamaChatSettings } from '../provider';
import {
  createExpectedUsage,
  createModel,
  mockOllamaClient,
} from './chat-language-model.test-helpers';

describe('OllamaChatLanguageModel: doGenerate', () => {
  let model: OllamaChatLanguageModel;

  beforeEach(() => {
    vi.clearAllMocks();
    model = createModel();
  });

  describe('initialization', () => {
    it('should initialize with correct properties', () => {
      expect(model.specificationVersion).toBe('v4');
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

      const options: LanguageModelV4CallOptions = {
        prompt: [{ role: 'user', content: [{ type: 'text', text: 'Hello' }] }],
      };

      const result = await model.doGenerate(options);

      expect(result.content).toEqual([{ type: 'text', text: 'Hello, world!' }]);
      expect(result.finishReason).toEqual({ unified: 'stop', raw: 'stop' });
      // V3 uses structured usage format
      expect(result.usage).toEqual(createExpectedUsage(5, 10));

      expect(mockOllamaClient.chat).toHaveBeenCalledWith({
        model: 'llama3.2',
        messages: [{ role: 'user', content: 'Hello' }],
        stream: false,
        options: expect.any(Object),
      });
    });

    it('should expose Ollama token counts and timings on usage.raw', async () => {
      vi.mocked(mockOllamaClient.chat).mockResolvedValueOnce({
        model: 'llama3.2',
        created_at: new Date(),
        message: { role: 'assistant', content: 'Hello, world!' },
        done: true,
        done_reason: 'stop',
        eval_count: 10,
        prompt_eval_count: 5,
        total_duration: 1_000_000_000,
        load_duration: 100_000_000,
        prompt_eval_duration: 200_000_000,
        eval_duration: 700_000_000,
      } as unknown as ChatResponse);

      const result = await model.doGenerate({
        prompt: [{ role: 'user', content: [{ type: 'text', text: 'Hello' }] }],
      });

      expect(result.usage.raw).toEqual({
        prompt_eval_count: 5,
        eval_count: 10,
        total_duration: 1_000_000_000,
        load_duration: 100_000_000,
        prompt_eval_duration: 200_000_000,
        eval_duration: 700_000_000,
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

      const options: LanguageModelV4CallOptions = {
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

      const options: LanguageModelV4CallOptions = {
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

      const options: LanguageModelV4CallOptions = {
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

    it('should return tool-calls finish reason when generation emits tool calls', async () => {
      const mockResponse = {
        model: 'llama3.2',
        created_at: new Date(),
        message: {
          role: 'assistant',
          content: '',
          tool_calls: [
            {
              function: {
                name: 'get_weather',
                arguments: { location: 'Paris' },
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

      vi.mocked(mockOllamaClient.chat).mockResolvedValueOnce(mockResponse);

      const options: LanguageModelV4CallOptions = {
        prompt: [
          {
            role: 'user',
            content: [{ type: 'text', text: 'What is the weather?' }],
          },
        ],
        tools: [
          {
            type: 'function',
            name: 'get_weather',
            description: 'Get weather for a city',
            inputSchema: {
              type: 'object',
              properties: {
                location: { type: 'string' },
              },
            },
          },
        ],
      };

      const result = await model.doGenerate(options);

      expect(result.finishReason).toEqual({
        unified: 'tool-calls',
        raw: 'stop',
      });
      expect(result.content).toEqual([
        {
          type: 'tool-call',
          toolCallId: expect.any(String),
          toolName: 'get_weather',
          input: JSON.stringify({ location: 'Paris' }),
        },
      ]);
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

      const options: LanguageModelV4CallOptions = {
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
          } as LanguageModelV4FunctionTool & { execute: typeof toolExecute },
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

      const options: LanguageModelV4CallOptions = {
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

      const options: LanguageModelV4CallOptions = {
        prompt: [
          {
            role: 'user',
            content: [{ type: 'text', text: 'Write a long story' }],
          },
        ],
      };

      const result = await model.doGenerate(options);

      expect(result.finishReason).toEqual({ unified: 'length', raw: 'length' });
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

      const options: LanguageModelV4CallOptions = {
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

      const options: LanguageModelV4CallOptions = {
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

      const options: LanguageModelV4CallOptions = {
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
      expect(result.finishReason).toEqual({ unified: 'stop', raw: 'stop' });
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

      const options: LanguageModelV4CallOptions = {
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
      expect(result.finishReason).toEqual({ unified: 'stop', raw: 'stop' });
    });
  });
});
