import { describe, it, expect } from 'vitest';
import { generateText } from 'ai';
import { ollama } from '../index';

describe(
  'Multi-Step Generation Integration Tests',
  { timeout: 120_000 },
  () => {
    it('should handle basic text generation', async () => {
      const result = await generateText({
        model: ollama('llama3.2'),
        prompt: 'Count from 1 to 3 step by step',
      });

      expect(result.text.length).toBeGreaterThan(0);
      expect(result.text.toLowerCase()).toContain('1');
    });

    it('should handle step-by-step instructions', async () => {
      const result = await generateText({
        model: ollama('llama3.2'),
        prompt: 'Explain how to make a sandwich in 3 steps',
      });

      expect(result.text.length).toBeGreaterThan(0);
      expect(result.text.toLowerCase()).toContain('step');
    });
  },
);
