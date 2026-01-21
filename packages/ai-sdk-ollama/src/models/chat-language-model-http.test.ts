/**
 * HTTP-level tests for OllamaChatLanguageModel
 *
 * These tests use @ai-sdk/test-server to mock HTTP requests at the network layer,
 * testing the actual HTTP protocol behavior rather than mocking the Ollama client.
 *
 * This provides an additional layer of verification that the provider correctly
 * constructs and handles HTTP requests/responses.
 */
import { describe, it, expect } from 'vitest';
import { createTestServer } from '@ai-sdk/test-server/with-vitest';
import { createOllama } from '../provider';
import { convertReadableStreamToArray } from '@ai-sdk/provider-utils/test';

// Default Ollama server URL
const OLLAMA_BASE_URL = 'http://127.0.0.1:11434';

const server = createTestServer({
  [`${OLLAMA_BASE_URL}/api/chat`]: {},
});

describe('OllamaChatLanguageModel HTTP-level tests', () => {
  describe('doGenerate', () => {
    it('should send correct HTTP request for text generation', async () => {
      server.urls[`${OLLAMA_BASE_URL}/api/chat`].response = {
        type: 'json-value',
        body: {
          model: 'llama3.2',
          created_at: new Date().toISOString(),
          message: {
            role: 'assistant',
            content: 'Hello from HTTP test!',
          },
          done: true,
          done_reason: 'stop',
          eval_count: 10,
          prompt_eval_count: 5,
          total_duration: 1_000_000_000,
          load_duration: 100_000_000,
          prompt_eval_duration: 200_000_000,
          eval_duration: 700_000_000,
        },
      };

      const provider = createOllama();
      const model = provider.chat('llama3.2');

      const result = await model.doGenerate({
        prompt: [
          { role: 'user', content: [{ type: 'text', text: 'Hello HTTP!' }] },
        ],
      });

      expect(result.content).toEqual([
        { type: 'text', text: 'Hello from HTTP test!' },
      ]);
      expect(result.finishReason).toEqual({ unified: 'stop', raw: 'stop' });

      // Verify the HTTP request was correct
      const requestBody = await server.calls[0]!.requestBodyJson;
      expect(requestBody).toMatchObject({
        model: 'llama3.2',
        messages: [{ role: 'user', content: 'Hello HTTP!' }],
        stream: false,
      });
    });

    it('should include options in HTTP request', async () => {
      server.urls[`${OLLAMA_BASE_URL}/api/chat`].response = {
        type: 'json-value',
        body: {
          model: 'llama3.2',
          created_at: new Date().toISOString(),
          message: {
            role: 'assistant',
            content: 'Response with options',
          },
          done: true,
          done_reason: 'stop',
          eval_count: 10,
          prompt_eval_count: 5,
          total_duration: 1_000_000_000,
          load_duration: 100_000_000,
          prompt_eval_duration: 200_000_000,
          eval_duration: 700_000_000,
        },
      };

      const provider = createOllama();
      const model = provider.chat('llama3.2');

      await model.doGenerate({
        prompt: [{ role: 'user', content: [{ type: 'text', text: 'Test' }] }],
        temperature: 0.7,
        maxOutputTokens: 100,
        topP: 0.9,
        topK: 50,
      });

      const requestBody = await server.calls[0]!.requestBodyJson;
      expect(requestBody.options).toMatchObject({
        temperature: 0.7,
        num_predict: 100,
        top_p: 0.9,
        top_k: 50,
      });
    });

    it('should handle JSON response format in HTTP request', async () => {
      server.urls[`${OLLAMA_BASE_URL}/api/chat`].response = {
        type: 'json-value',
        body: {
          model: 'llama3.2',
          created_at: new Date().toISOString(),
          message: {
            role: 'assistant',
            content: '{"result": "json"}',
          },
          done: true,
          done_reason: 'stop',
          eval_count: 10,
          prompt_eval_count: 5,
          total_duration: 1_000_000_000,
          load_duration: 100_000_000,
          prompt_eval_duration: 200_000_000,
          eval_duration: 700_000_000,
        },
      };

      const provider = createOllama();
      const model = provider.chat('llama3.2');

      await model.doGenerate({
        prompt: [
          { role: 'user', content: [{ type: 'text', text: 'Generate JSON' }] },
        ],
        responseFormat: { type: 'json' },
      });

      const requestBody = await server.calls[0]!.requestBodyJson;
      expect(requestBody.format).toBe('json');
    });
  });

  describe('doStream', () => {
    it('should send correct HTTP request for streaming', async () => {
      // Ollama uses newline-delimited JSON for streaming
      server.urls[`${OLLAMA_BASE_URL}/api/chat`].response = {
        type: 'stream-chunks',
        chunks: [
          JSON.stringify({
            model: 'llama3.2',
            created_at: new Date().toISOString(),
            message: { role: 'assistant', content: 'Hello' },
            done: false,
          }) + '\n',
          JSON.stringify({
            model: 'llama3.2',
            created_at: new Date().toISOString(),
            message: { role: 'assistant', content: ' world' },
            done: false,
          }) + '\n',
          JSON.stringify({
            model: 'llama3.2',
            created_at: new Date().toISOString(),
            message: { role: 'assistant', content: '!' },
            done: true,
            done_reason: 'stop',
            eval_count: 15,
            prompt_eval_count: 8,
            total_duration: 1_000_000_000,
            load_duration: 100_000_000,
            prompt_eval_duration: 200_000_000,
            eval_duration: 700_000_000,
          }) + '\n',
        ],
      };

      const provider = createOllama();
      const model = provider.chat('llama3.2');

      const { stream } = await model.doStream({
        prompt: [
          { role: 'user', content: [{ type: 'text', text: 'Hello stream!' }] },
        ],
      });

      const chunks = await convertReadableStreamToArray(stream);

      // Check that streaming request was made
      const requestBody = await server.calls[0]!.requestBodyJson;
      expect(requestBody.stream).toBe(true);

      // Check we got stream parts
      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks.find((c) => c.type === 'stream-start')).toBeDefined();
      expect(chunks.find((c) => c.type === 'finish')).toBeDefined();
    });
  });
});
