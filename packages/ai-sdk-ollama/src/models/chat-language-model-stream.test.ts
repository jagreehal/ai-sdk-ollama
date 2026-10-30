import { describe, it, expect, beforeEach, vi } from 'vitest';
import { OllamaChatLanguageModel } from './chat-language-model';
import {
  LanguageModelV4CallOptions,
  LanguageModelV4StreamPart,
} from '@ai-sdk/provider';
import { ChatResponse } from 'ollama';
import type { AbortableStream } from '../ollama-client';
import {
  createExpectedUsage,
  createModel,
  mockChatStream,
  mockChat,
  mockOllamaClient,
} from './chat-language-model.test-helpers';

describe('OllamaChatLanguageModel: doStream', () => {
  let model: OllamaChatLanguageModel;

  beforeEach(() => {
    vi.clearAllMocks();
    model = createModel();
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

      mockChatStream(mockStreamData);

      const options: LanguageModelV4CallOptions = {
        prompt: [{ role: 'user', content: [{ type: 'text', text: 'Hello' }] }],
      };

      const { stream } = await model.doStream(options);
      const chunks = await Array.fromAsync(stream);

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
        finishReason: { unified: 'stop', raw: 'stop' },
        usage: createExpectedUsage(8, 15),
        // Same `providerMetadata.ollama` shape `doGenerate` returns, built from
        // the final chunk. Durations Ollama reports per-call only; per-token
        // counters live on `usage.raw`.
        providerMetadata: {
          ollama: {
            model: 'llama3.2',
            created_at: expect.any(String),
            total_duration: 1_000_000_000,
            load_duration: 100_000_000,
            eval_duration: 700_000_000,
          },
        },
      });

      // `usage.raw` carries Ollama's own counters and timings verbatim.
      expect((chunks[6] as { usage: { raw: unknown } }).usage.raw).toEqual({
        prompt_eval_count: 8,
        eval_count: 15,
        total_duration: 1_000_000_000,
        load_duration: 100_000_000,
        prompt_eval_duration: 200_000_000,
        eval_duration: 700_000_000,
      });

      expect(mockChat).toHaveBeenCalledWith({
        model: 'llama3.2',
        messages: [{ role: 'user', content: 'Hello' }],
        stream: true,
        options: expect.objectContaining({}),
      });
    });

    it('should return tool-calls finish reason when stream emits tool calls', async () => {
      const mockStreamData = [
        {
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
          message: { role: 'assistant', content: '' },
          done: true,
          done_reason: 'stop',
          eval_count: 10,
          prompt_eval_count: 5,
          total_duration: 1_000_000_000,
          load_duration: 100_000_000,
          prompt_eval_duration: 200_000_000,
          eval_duration: 700_000_000,
        },
      ];

      mockChatStream(mockStreamData);

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

      const { stream } = await model.doStream(options);
      const chunks = await Array.fromAsync(stream);

      expect(chunks).toEqual([
        {
          type: 'stream-start',
          warnings: [],
        },
        {
          type: 'tool-call',
          toolCallId: expect.any(String),
          toolName: 'get_weather',
          input: JSON.stringify({ location: 'Paris' }),
        },
        {
          type: 'finish',
          finishReason: {
            unified: 'tool-calls',
            raw: 'stop',
          },
          usage: createExpectedUsage(5, 10),
          providerMetadata: expect.any(Object),
        },
      ]);
    });

    it('should emit raw chunks when includeRawChunks is enabled', async () => {
      const mockStreamData = [
        {
          model: 'llama3.2',
          created_at: new Date(),
          message: { role: 'assistant', content: 'Hi' },
          done: false,
        },
        {
          model: 'llama3.2',
          created_at: new Date(),
          message: { role: 'assistant', content: '' },
          done: true,
          done_reason: 'stop',
          eval_count: 2,
          prompt_eval_count: 1,
        },
      ] as unknown as ChatResponse[];

      mockChatStream(mockStreamData);

      const { stream } = await model.doStream({
        prompt: [{ role: 'user', content: [{ type: 'text', text: 'Hello' }] }],
        includeRawChunks: true,
      });
      const chunks = await Array.fromAsync(stream);

      const rawChunks = chunks.filter((chunk) => chunk.type === 'raw');
      expect(rawChunks).toEqual([
        { type: 'raw', rawValue: mockStreamData[0] },
        { type: 'raw', rawValue: mockStreamData[1] },
      ]);
    });

    it('should not emit raw chunks by default', async () => {
      mockChatStream([
        {
          model: 'llama3.2',
          created_at: new Date(),
          message: { role: 'assistant', content: 'Hi' },
          done: true,
          done_reason: 'stop',
          eval_count: 2,
          prompt_eval_count: 1,
        },
      ] as unknown as ChatResponse[]);

      const { stream } = await model.doStream({
        prompt: [{ role: 'user', content: [{ type: 'text', text: 'Hello' }] }],
      });
      const chunks = await Array.fromAsync(stream);

      expect(chunks.some((chunk) => chunk.type === 'raw')).toBe(false);
    });

    it('should handle streaming errors', async () => {
      const error = new Error('Stream error');
      vi.mocked(mockChat).mockRejectedValueOnce(error);

      const options: LanguageModelV4CallOptions = {
        prompt: [{ role: 'user', content: [{ type: 'text', text: 'Hello' }] }],
      };

      await expect(model.doStream(options)).rejects.toThrow('Stream error');
    });

    it('aborts the Ollama request when the stream is cancelled', async () => {
      const abort = vi.fn();
      let release: () => void = () => {};
      const aborted = new Promise<void>((resolve) => {
        release = resolve;
      });
      abort.mockImplementation(() => release());
      const mockStream: AbortableStream<ChatResponse> = {
        abort,
        async *[Symbol.asyncIterator]() {
          yield {
            model: 'llama3.2',
            created_at: new Date(),
            message: { role: 'assistant', content: 'Hello' },
            done: false,
          } as ChatResponse;
          // Ollama keeps generating until the request is aborted.
          await aborted;
        },
      };
      (mockChat as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        mockStream,
      );

      const { stream } = await model.doStream({
        prompt: [{ role: 'user', content: [{ type: 'text', text: 'Hello' }] }],
      });
      const reader = stream.getReader();
      await reader.read(); // stream-start
      await reader.read(); // text-start
      await reader.cancel();

      expect(abort).toHaveBeenCalledTimes(1);
    });

    it('should handle abort signal in streaming', async () => {
      const abortController = new AbortController();
      const mockAsyncIterable: AbortableStream<ChatResponse> = {
        abort: vi.fn(),
        [Symbol.asyncIterator]: vi.fn().mockReturnValue({
          next: vi.fn().mockImplementation(async () => {
            abortController.abort();
            throw new Error('Aborted');
          }),
        }),
      };

      (mockChat as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        mockAsyncIterable,
      );

      const options: LanguageModelV4CallOptions = {
        prompt: [{ role: 'user', content: [{ type: 'text', text: 'Hello' }] }],
        abortSignal: abortController.signal,
      };

      const { stream } = await model.doStream(options);

      expect(mockChat).toHaveBeenCalledWith(
        expect.objectContaining({ stream: true }),
        { signal: abortController.signal },
      );

      await expect(async () => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        for await (const _chunk of stream) {
          // Should throw before getting here
        }
      }).rejects.toThrow('Aborted');
    });
  });

  describe('doStream when the stream ends before done', () => {
    const options: LanguageModelV4CallOptions = {
      prompt: [{ role: 'user', content: [{ type: 'text', text: 'Hello' }] }],
    };

    it('should close the open text block, report an error and finish when no done chunk arrives', async () => {
      mockChatStream([
        {
          model: 'llama3.2',
          created_at: new Date(),
          message: { role: 'assistant', content: 'Hello' },
          done: false,
        },
        {
          model: 'llama3.2',
          created_at: new Date(),
          message: { role: 'assistant', content: ' wor' },
          done: false,
        },
      ] as ChatResponse[]);

      const { stream } = await model.doStream(options);
      const chunks = await Array.fromAsync(stream);

      expect(chunks.map((chunk) => chunk.type)).toEqual([
        'stream-start',
        'text-start',
        'text-delta',
        'text-delta',
        'text-end',
        'error',
        'finish',
      ]);
      expect(chunks.at(-2)).toMatchObject({
        type: 'error',
        error: { message: 'Ollama stream ended without a done chunk.' },
      });
      expect(chunks.at(-1)).toMatchObject({
        type: 'finish',
        finishReason: { unified: 'error', raw: undefined },
      });
    });

    it('should close an open reasoning block when no done chunk arrives', async () => {
      mockChatStream([
        {
          model: 'llama3.2',
          created_at: new Date(),
          message: { role: 'assistant', content: '', thinking: 'Let me see' },
          done: false,
        },
      ] as ChatResponse[]);

      const { stream } = await model.doStream(options);
      const chunks = await Array.fromAsync(stream);

      expect(chunks.map((chunk) => chunk.type)).toEqual([
        'stream-start',
        'reasoning-start',
        'reasoning-delta',
        'reasoning-end',
        'error',
        'finish',
      ]);
    });

    it('should still report an error and finish when the stream ends without any chunk', async () => {
      mockChatStream([]);

      const { stream } = await model.doStream(options);
      const chunks = await Array.fromAsync(stream);

      expect(chunks.map((chunk) => chunk.type)).toEqual([
        'stream-start',
        'error',
        'finish',
      ]);
    });

    it('should error the stream, without a synthetic finish, when the iterator throws after a chunk (default client path)', async () => {
      const cut = new Error(
        'Did not receive done or success response in stream.',
      );
      const stream: AbortableStream<ChatResponse> = {
        abort() {},
        [Symbol.asyncIterator]: async function* () {
          yield {
            model: 'llama3.2',
            created_at: new Date(),
            message: { role: 'assistant', content: 'Hello' },
            done: false,
          } as ChatResponse;
          throw cut;
        },
      };
      vi.mocked(mockChat).mockResolvedValueOnce(stream);

      const { stream: result } = await model.doStream(options);
      const reader = result.getReader();
      const chunks: LanguageModelV4StreamPart[] = [];
      let thrown: unknown;
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(value);
        }
      } catch (error) {
        thrown = error;
      }

      expect(thrown).toBe(cut);
      expect(chunks.some((chunk) => chunk.type === 'finish')).toBe(false);
      expect(chunks.some((chunk) => chunk.type === 'error')).toBe(false);
    });

    it('should not add a second finish after a done chunk', async () => {
      mockChatStream([
        {
          model: 'llama3.2',
          created_at: new Date(),
          message: { role: 'assistant', content: 'Hi' },
          done: true,
          done_reason: 'stop',
        },
      ] as ChatResponse[]);

      const { stream } = await model.doStream(options);
      const chunks = await Array.fromAsync(stream);

      expect(chunks.filter((chunk) => chunk.type === 'finish')).toHaveLength(1);
      expect(chunks.some((chunk) => chunk.type === 'error')).toBe(false);
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

      mockChatStream(mockStreamData);

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

      const { stream } = await modelWithReasoning.doStream(options);
      const chunks: LanguageModelV4StreamPart[] = await Array.fromAsync(stream);

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

      // Verify that all reasoning events use the same ID
      // This is critical for AI SDK to properly aggregate reasoning content
      expect(reasoningStart?.id).toBeDefined();
      expect(reasoningDelta?.id).toBeDefined();
      expect(reasoningEnd?.id).toBeDefined();
      expect(reasoningStart?.id).toBe(reasoningDelta?.id);
      expect(reasoningDelta?.id).toBe(reasoningEnd?.id);
      expect(reasoningStart?.id).toBe(reasoningEnd?.id);

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
      expect(finish?.finishReason).toEqual({ unified: 'stop', raw: 'stop' });
    });

    it('should preserve returned reasoning stream parts when think is disabled', async () => {
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

      mockChatStream(mockStreamData);

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

      const { stream } = await modelWithoutReasoning.doStream(options);
      const chunks: LanguageModelV4StreamPart[] = await Array.fromAsync(stream);

      // The request setting controls generation, not returned content.
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
      expect(reasoningDelta?.delta).toBe(
        'Let me think about this step by step.',
      );
      expect(reasoningEnd).toBeDefined();
      // Final text may be emitted on the done chunk; accept either behavior
      if (textDelta) {
        expect(textDelta).toEqual({
          type: 'text-delta',
          id: expect.any(String),
          delta: 'The answer is 42.',
        });
      }
      expect(finish).toBeDefined();
      expect(finish?.finishReason).toEqual({ unified: 'stop', raw: 'stop' });
    });

    it('should emit a single reasoning-start/end cycle for multiple reasoning chunks', async () => {
      // Simulate how models like Qwen 3/DeepSeek-R1 stream reasoning tokens
      // chunk-by-chunk (each chunk has a thinking field with a small piece)
      const mockStreamData: ChatResponse[] = [
        {
          model: 'llama3.2',
          created_at: new Date(),
          message: {
            role: 'assistant',
            content: '',
            thinking: 'Let me ',
          },
          done: false,
          done_reason: 'stop',
          eval_count: 2,
          prompt_eval_count: 3,
          total_duration: 200_000_000,
          load_duration: 50_000_000,
          prompt_eval_duration: 100_000_000,
          eval_duration: 100_000_000,
        },
        {
          model: 'llama3.2',
          created_at: new Date(),
          message: {
            role: 'assistant',
            content: '',
            thinking: 'think about ',
          },
          done: false,
          done_reason: 'stop',
          eval_count: 4,
          prompt_eval_count: 3,
          total_duration: 400_000_000,
          load_duration: 50_000_000,
          prompt_eval_duration: 100_000_000,
          eval_duration: 300_000_000,
        },
        {
          model: 'llama3.2',
          created_at: new Date(),
          message: {
            role: 'assistant',
            content: '',
            thinking: 'this.',
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
            content: 'The answer is 4.',
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

      mockChatStream(mockStreamData);

      const modelWithReasoning = new OllamaChatLanguageModel(
        'llama3.2',
        { think: true },
        { client: mockOllamaClient, provider: 'ollama' },
      );

      const options: LanguageModelV4CallOptions = {
        prompt: [
          {
            role: 'user',
            content: [{ type: 'text', text: 'What is 2 + 2?' }],
          },
        ],
      };

      const { stream } = await modelWithReasoning.doStream(options);
      const chunks: LanguageModelV4StreamPart[] = await Array.fromAsync(stream);

      // There should be exactly ONE reasoning-start and ONE reasoning-end
      const reasoningStarts = chunks.filter(
        (part) => part.type === 'reasoning-start',
      );
      const reasoningDeltas = chunks.filter(
        (part) => part.type === 'reasoning-delta',
      );
      const reasoningEnds = chunks.filter(
        (part) => part.type === 'reasoning-end',
      );

      expect(reasoningStarts).toHaveLength(1);
      expect(reasoningEnds).toHaveLength(1);
      // Three reasoning chunks should produce three deltas
      expect(reasoningDeltas).toHaveLength(3);

      // All reasoning events must share the same ID
      const reasoningId = reasoningStarts[0]?.id;
      expect(reasoningId).toBeDefined();
      for (const delta of reasoningDeltas) {
        expect(delta.id).toBe(reasoningId);
      }
      expect(reasoningEnds[0]?.id).toBe(reasoningId);

      // Verify the delta content
      expect(reasoningDeltas[0]?.delta).toBe('Let me ');
      expect(reasoningDeltas[1]?.delta).toBe('think about ');
      expect(reasoningDeltas[2]?.delta).toBe('this.');

      // Verify text content follows reasoning
      const textDelta = chunks.find((part) => part.type === 'text-delta');
      if (textDelta) {
        expect(textDelta).toEqual({
          type: 'text-delta',
          id: expect.any(String),
          delta: 'The answer is 4.',
        });
      }

      const finish = chunks.find((part) => part.type === 'finish');
      expect(finish).toBeDefined();
      expect(finish?.finishReason).toEqual({ unified: 'stop', raw: 'stop' });
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

      mockChatStream(mockStreamData);

      const options: LanguageModelV4CallOptions = {
        prompt: [{ role: 'user', content: [{ type: 'text', text: 'Hello' }] }],
      };

      const { stream } = await model.doStream(options);
      const chunks: LanguageModelV4StreamPart[] = await Array.fromAsync(stream);

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
        finishReason: { unified: 'stop', raw: 'stop' },
        usage: createExpectedUsage(8, 15),
        providerMetadata: expect.any(Object),
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

      mockChatStream(mockStreamData);

      const options: LanguageModelV4CallOptions = {
        prompt: [{ role: 'user', content: [{ type: 'text', text: 'Test' }] }],
      };

      const { stream } = await model.doStream(options);
      const chunks: LanguageModelV4StreamPart[] = await Array.fromAsync(stream);

      // Should have stream-start + finish (no text parts since content is empty)
      expect(chunks).toHaveLength(2);
      expect(chunks[0]).toEqual({
        type: 'stream-start',
        warnings: [],
      });
      expect(chunks[1]).toEqual({
        type: 'finish',
        finishReason: { unified: 'stop', raw: 'stop' },
        usage: createExpectedUsage(5, 0),
        providerMetadata: expect.any(Object),
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

      mockChatStream(mockStreamData);

      const options: LanguageModelV4CallOptions = {
        prompt: [{ role: 'user', content: [{ type: 'text', text: 'Test' }] }],
      };

      const { stream } = await model.doStream(options);
      const chunks: LanguageModelV4StreamPart[] = await Array.fromAsync(stream);

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
        finishReason: { unified: 'stop', raw: 'stop' },
        usage: createExpectedUsage(8, 15),
        providerMetadata: expect.any(Object),
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

      mockChatStream(mockStreamData);

      const options: LanguageModelV4CallOptions = {
        prompt: [{ role: 'user', content: [{ type: 'text', text: 'Test' }] }],
      };

      const { stream } = await model.doStream(options);
      const chunks: LanguageModelV4StreamPart[] = await Array.fromAsync(stream);

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
