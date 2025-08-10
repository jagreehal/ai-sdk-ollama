import { describe, it, expect } from 'vitest';
import { generateText, streamText } from 'ai';
import { ollama } from '../index';

describe(
  'Messages and System Prompts Integration Tests',
  { timeout: 120_000 },
  () => {
    it('should handle system messages', async () => {
      const result = await generateText({
        model: ollama('llama3.2'),
        system:
          'You are a helpful assistant that always responds in haiku format.',
        prompt: 'What is the weather?',
        maxOutputTokens: 100,
        temperature: 0.3,
      });

      expect(result.text).toBeTruthy();
      // Count lines for haiku format (3 lines typical)
      const lines = result.text
        .trim()
        .split('\n')
        .filter((l) => l.trim());
      expect(lines.length).toBeGreaterThanOrEqual(1);
      expect(lines.length).toBeLessThanOrEqual(5);
    });

    it('should handle multiple message roles', async () => {
      const result = await generateText({
        model: ollama('llama3.2'),
        messages: [
          { role: 'system', content: 'You are a helpful math tutor.' },
          { role: 'user', content: 'What is 2 + 2?' },
          { role: 'assistant', content: '2 + 2 equals 4.' },
          { role: 'user', content: 'And what is 4 + 4?' },
        ],
        maxOutputTokens: 50,
        temperature: 0,
      });

      expect(result.text).toBeTruthy();
      expect(result.text).toMatch(/8|eight/i);
    });

    it('should support completion mode with prompt', async () => {
      const result = await generateText({
        model: ollama('llama3.2'),
        prompt: 'The capital of France is',
        maxOutputTokens: 20,
        temperature: 0,
      });

      expect(result.text).toBeTruthy();
      expect(result.text.toLowerCase()).toMatch(/paris/);
    });

    it('should stream with system message', async () => {
      const result = await streamText({
        model: ollama('llama3.2'),
        system: 'You are a pirate. Always respond as a pirate would.',
        prompt: 'Hello there!',
        maxOutputTokens: 100,
        temperature: 0.5,
      });

      const chunks: string[] = [];
      for await (const chunk of result.textStream) {
        chunks.push(chunk);
      }

      const fullText = chunks.join('');
      expect(fullText).toBeTruthy();
      // Should contain pirate-like language
      expect(fullText.toLowerCase()).toMatch(/ahoy|arr|matey|ye|aye/);
    });

    it('should handle assistant messages in conversation', async () => {
      const result = await generateText({
        model: ollama('llama3.2'),
        messages: [
          { role: 'user', content: 'My name is Alice.' },
          { role: 'assistant', content: 'Nice to meet you, Alice!' },
          { role: 'user', content: 'What is my name?' },
        ],
        maxOutputTokens: 50,
        temperature: 0,
      });

      expect(result.text).toBeTruthy();
      expect(result.text.toLowerCase()).toContain('alice');
    });

    it('should handle empty system message', async () => {
      const result = await generateText({
        model: ollama('llama3.2'),
        system: '',
        prompt: 'Say hello',
        maxOutputTokens: 20,
        temperature: 0,
      });

      expect(result.text).toBeTruthy();
      expect(result.text.toLowerCase()).toContain('hello');
    });

    it('should handle long system prompts', async () => {
      const longSystemPrompt = `You are an AI assistant with the following characteristics:
        1. You are helpful and informative
        2. You provide concise answers
        3. You focus on accuracy
        4. You admit when you don't know something
        5. You are respectful and professional`;

      const result = await generateText({
        model: ollama('llama3.2'),
        system: longSystemPrompt,
        prompt: 'What is 10 divided by 2?',
        maxOutputTokens: 50,
        temperature: 0,
      });

      expect(result.text).toBeTruthy();
      expect(result.text).toMatch(/5|five/i);
    });
  },
);
