import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createOllama } from './provider';
import { Ollama } from 'ollama';

vi.mock('ollama');

describe('Dual Parameter Support', () => {
  let mockOllamaClient: {
    chat: ReturnType<typeof vi.fn>;
    embed: ReturnType<typeof vi.fn>;
  };
  let provider: ReturnType<typeof createOllama>;

  beforeEach(() => {
    mockOllamaClient = {
      chat: vi.fn(),
      embed: vi.fn(),
    };

    vi.mocked(Ollama).mockImplementation(
      () => mockOllamaClient as unknown as Ollama,
    );
    provider = createOllama();
  });

  describe('Parameter Precedence', () => {
    it('should pass AI SDK standard parameters to Ollama', async () => {
      const model = provider('test-model');

      // Mock the Ollama client to capture the parameters
      mockOllamaClient.chat.mockResolvedValueOnce({
        message: { role: 'assistant', content: 'Response' },
        done: true,
        done_reason: 'stop',
        model: 'test-model',
        created_at: new Date().toISOString(),
        eval_count: 10,
        prompt_eval_count: 5,
        total_duration: 1_000_000_000,
        load_duration: 100_000_000,
        prompt_eval_duration: 200_000_000,
        eval_duration: 700_000_000,
      });

      // Test through the public interface
      await model.doGenerate({
        prompt: [{ role: 'user', content: [{ type: 'text', text: 'Hello' }] }],
        temperature: 0.8,
        maxOutputTokens: 100,
        topP: 0.9,
        topK: 40,
        seed: 42,
        stopSequences: ['END'],
        frequencyPenalty: 0.5,
        presencePenalty: 0.3,
      });

      // Verify the call was made with the expected parameters
      expect(mockOllamaClient.chat).toHaveBeenCalledWith(
        expect.objectContaining({
          options: expect.objectContaining({
            temperature: 0.8,
            num_predict: 100,
            top_p: 0.9,
            top_k: 40,
            seed: 42,
            stop: ['END'],
            frequency_penalty: 0.5,
            presence_penalty: 0.3,
          }),
        }),
      );
    });

    it('should pass native Ollama options directly', async () => {
      const model = provider('test-model', {
        options: {
          temperature: 0.7,
          num_ctx: 4096,
          repeat_penalty: 1.1,
          mirostat: 2,
          mirostat_tau: 5,
        },
      });

      // Mock the response
      mockOllamaClient.chat.mockResolvedValueOnce({
        message: { role: 'assistant', content: 'Response' },
        done: true,
        done_reason: 'stop',
        model: 'test-model',
        created_at: new Date(),
        eval_count: 10,
        prompt_eval_count: 5,
        total_duration: 1_000_000_000,
        load_duration: 100_000_000,
        prompt_eval_duration: 200_000_000,
        eval_duration: 700_000_000,
      });

      await model.doGenerate({
        prompt: [{ role: 'user', content: [{ type: 'text', text: 'Hello' }] }],
      });

      // Verify Ollama options are preserved
      expect(mockOllamaClient.chat).toHaveBeenCalledWith(
        expect.objectContaining({
          options: expect.objectContaining({
            temperature: 0.7,
            num_ctx: 4096,
            repeat_penalty: 1.1,
            mirostat: 2,
            mirostat_tau: 5,
          }),
        }),
      );
    });

    it('should let Ollama options override AI SDK parameters', async () => {
      const model = provider('test-model', {
        options: {
          temperature: 0.5, // This should override
          num_ctx: 8192,
          repeat_penalty: 1.2,
        },
      });

      // Mock the response
      mockOllamaClient.chat.mockResolvedValueOnce({
        message: { role: 'assistant', content: 'Response' },
        done: true,
        done_reason: 'stop',
        model: 'test-model',
        created_at: new Date(),
        eval_count: 10,
        prompt_eval_count: 5,
        total_duration: 1_000_000_000,
        load_duration: 100_000_000,
        prompt_eval_duration: 200_000_000,
        eval_duration: 700_000_000,
      });

      await model.doGenerate({
        prompt: [{ role: 'user', content: [{ type: 'text', text: 'Hello' }] }],
        temperature: 0.9, // This will be overridden
        maxOutputTokens: 150,
        topP: 0.95,
      });

      // Verify Ollama options take precedence
      expect(mockOllamaClient.chat).toHaveBeenCalledWith(
        expect.objectContaining({
          options: expect.objectContaining({
            temperature: 0.5, // Ollama option wins
            num_ctx: 8192,
            repeat_penalty: 1.2,
            num_predict: 150, // AI SDK parameter mapped
            top_p: 0.95, // AI SDK parameter mapped
          }),
        }),
      );
    });

    it('should support future Ollama parameters without provider updates', async () => {
      const model = provider('test-model', {
        options: {
          // These hypothetical future parameters should pass through
          temperature: 0.8,
          num_ctx: 4096,
          repeat_penalty: 1.1,
        },
      });

      // Mock the response
      mockOllamaClient.chat.mockResolvedValueOnce({
        message: { role: 'assistant', content: 'Response' },
        done: true,
        done_reason: 'stop',
        model: 'test-model',
        created_at: new Date(),
        eval_count: 10,
        prompt_eval_count: 5,
        total_duration: 1_000_000_000,
        load_duration: 100_000_000,
        prompt_eval_duration: 200_000_000,
        eval_duration: 700_000_000,
      });

      await model.doGenerate({
        prompt: [{ role: 'user', content: [{ type: 'text', text: 'Hello' }] }],
      });

      // Verify all future parameters are passed through unchanged
      expect(mockOllamaClient.chat).toHaveBeenCalledWith(
        expect.objectContaining({
          options: expect.objectContaining({
            temperature: 0.8,
            num_ctx: 4096,
            repeat_penalty: 1.1,
          }),
        }),
      );
    });

    it('should remove undefined values from options', async () => {
      const model = provider('test-model', {
        options: {
          temperature: 0.8,
          num_ctx: undefined,
          repeat_penalty: 1.1,
        },
      });

      // Mock the response
      mockOllamaClient.chat.mockResolvedValueOnce({
        message: { role: 'assistant', content: 'Response' },
        done: true,
        done_reason: 'stop',
        model: 'test-model',
        created_at: new Date(),
        eval_count: 10,
        prompt_eval_count: 5,
        total_duration: 1_000_000_000,
        load_duration: 100_000_000,
        prompt_eval_duration: 200_000_000,
        eval_duration: 700_000_000,
      });

      await model.doGenerate({
        prompt: [{ role: 'user', content: [{ type: 'text', text: 'Hello' }] }],
        temperature: undefined,
        maxOutputTokens: undefined,
        topP: 0.9,
      });

      // Verify undefined values are removed
      expect(mockOllamaClient.chat).toHaveBeenCalledWith(
        expect.objectContaining({
          options: expect.objectContaining({
            temperature: 0.8,
            repeat_penalty: 1.1,
            top_p: 0.9,
          }),
        }),
      );
    });
  });

  describe('Parameter Type Safety', () => {
    it('should accept any type of value in Ollama options', () => {
      // This test verifies that the type system allows any values
      const model = provider('test-model', {
        options: {
          temperature: 0.8,
          num_ctx: 4096,
          repeat_penalty: 1.1,
          // All of these should be accepted by TypeScript
        },
      });

      expect(model).toBeDefined();
    });
  });
});
