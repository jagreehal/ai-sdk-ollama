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

    vi.mocked(Ollama).mockImplementation(() => mockOllamaClient);
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

      // Call the internal method to check parameter mapping
      const options = model['getCallOptions']({
        inputFormat: 'prompt',
        prompt: [{ role: 'user', content: [{ type: 'text', text: 'Hello' }] }],
        temperature: 0.8,
        maxOutputTokens: 100,
        topP: 0.9,
        topK: 40,
        seed: 42,
        stopSequences: ['END'],
        frequencyPenalty: 0.5,
        presencePenalty: 0.3,
        maxRetries: 0,
      });

      // Verify AI SDK parameters are mapped to Ollama options
      expect(options.options).toEqual({
        temperature: 0.8,
        num_predict: 100,
        top_p: 0.9,
        top_k: 40,
        seed: 42,
        stop: ['END'],
        frequency_penalty: 0.5,
        presence_penalty: 0.3,
      });
    });

    it('should pass native Ollama options directly', async () => {
      const model = provider('test-model', {
        options: {
          temperature: 0.7,
          num_ctx: 4096,
          repeat_penalty: 1.1,
          mirostat: 2,
          mirostat_tau: 5,
          custom_future_param: 'test',
        },
      });

      const options = model['getCallOptions']({
        inputFormat: 'prompt',
        prompt: [{ role: 'user', content: [{ type: 'text', text: 'Hello' }] }],
        maxRetries: 0,
      });

      // Verify Ollama options are preserved
      expect(options.options).toEqual({
        temperature: 0.7,
        num_ctx: 4096,
        repeat_penalty: 1.1,
        mirostat: 2,
        mirostat_tau: 5,
        custom_future_param: 'test',
      });
    });

    it('should let Ollama options override AI SDK parameters', async () => {
      const model = provider('test-model', {
        options: {
          temperature: 0.5, // This should override
          num_ctx: 8192,
          repeat_penalty: 1.2,
        },
      });

      const options = model['getCallOptions']({
        inputFormat: 'prompt',
        prompt: [{ role: 'user', content: [{ type: 'text', text: 'Hello' }] }],
        temperature: 0.9, // This will be overridden
        maxOutputTokens: 150,
        topP: 0.95,
        maxRetries: 0,
      });

      // Verify Ollama options take precedence
      expect(options.options).toEqual({
        temperature: 0.5, // Ollama option wins
        num_ctx: 8192,
        repeat_penalty: 1.2,
        num_predict: 150, // AI SDK parameter mapped
        top_p: 0.95, // AI SDK parameter mapped
      });
    });

    it('should support future Ollama parameters without provider updates', async () => {
      const model = provider('test-model', {
        options: {
          // These hypothetical future parameters should pass through
          experimental_feature_x: true,
          new_sampling_method: 'advanced',
          future_optimization: 2.5,
          quantum_mode: false,
          neural_boost: { level: 3, type: 'adaptive' },
        },
      });

      const options = model['getCallOptions']({
        inputFormat: 'prompt',
        prompt: [{ role: 'user', content: [{ type: 'text', text: 'Hello' }] }],
        maxRetries: 0,
      });

      // Verify all future parameters are passed through unchanged
      expect(options.options).toEqual({
        experimental_feature_x: true,
        new_sampling_method: 'advanced',
        future_optimization: 2.5,
        quantum_mode: false,
        neural_boost: { level: 3, type: 'adaptive' },
      });
    });

    it('should remove undefined values from options', async () => {
      const model = provider('test-model', {
        options: {
          temperature: 0.8,
          num_ctx: undefined,
          repeat_penalty: 1.1,
        },
      });

      const options = model['getCallOptions']({
        inputFormat: 'prompt',
        prompt: [{ role: 'user', content: [{ type: 'text', text: 'Hello' }] }],
        temperature: undefined,
        maxOutputTokens: undefined,
        topP: 0.9,
        maxRetries: 0,
      });

      // Verify undefined values are removed
      expect(options.options).toEqual({
        temperature: 0.8,
        repeat_penalty: 1.1,
        top_p: 0.9,
      });
      expect('num_ctx' in options.options).toBe(false);
      expect('num_predict' in options.options).toBe(false);
    });
  });

  describe('Parameter Type Safety', () => {
    it('should accept any type of value in Ollama options', () => {
      // This test verifies that the type system allows any values
      const model = provider('test-model', {
        options: {
          string_param: 'value',
          number_param: 42,
          boolean_param: true,
          array_param: [1, 2, 3],
          object_param: { nested: 'value' },
          null_param: null,
          // All of these should be accepted by TypeScript
        },
      });

      expect(model).toBeDefined();
    });
  });
});
