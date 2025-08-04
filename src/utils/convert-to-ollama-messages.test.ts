import { describe, it, expect } from 'vitest';
import { convertToOllamaChatMessages } from './convert-to-ollama-messages';
import { LanguageModelV2Prompt } from '@ai-sdk/provider';

describe('convertToOllamaChatMessages', () => {
  describe('system messages', () => {
    it('should convert system message', () => {
      const prompt: LanguageModelV2Prompt = [
        {
          role: 'system',
          content: 'You are a helpful assistant.',
        },
      ];

      const result = convertToOllamaChatMessages(prompt);

      expect(result).toEqual([
        {
          role: 'system',
          content: 'You are a helpful assistant.',
        },
      ]);
    });
  });

  describe('user messages', () => {
    it('should convert simple user message', () => {
      const prompt: LanguageModelV2Prompt = [
        {
          role: 'user',
          content: 'Hello, how are you?',
        },
      ];

      const result = convertToOllamaChatMessages(prompt);

      expect(result).toEqual([
        {
          role: 'user',
          content: 'Hello, how are you?',
        },
      ]);
    });

    it('should convert user message with text parts', () => {
      const prompt: LanguageModelV2Prompt = [
        {
          role: 'user',
          content: [
            { type: 'text', text: 'First part' },
            { type: 'text', text: 'Second part' },
          ],
        },
      ];

      const result = convertToOllamaChatMessages(prompt);

      expect(result).toEqual([
        {
          role: 'user',
          content: 'First part\nSecond part',
        },
      ]);
    });

    it('should convert user message with image URL', () => {
      const prompt: LanguageModelV2Prompt = [
        {
          role: 'user',
          content: [
            { type: 'text', text: 'What is in this image?' },
            { type: 'image', image: new URL('https://example.com/image.jpg') },
          ],
        },
      ];

      const result = convertToOllamaChatMessages(prompt);

      expect(result).toEqual([
        {
          role: 'user',
          content: 'What is in this image?',
          images: ['https://example.com/image.jpg'],
        },
      ]);
    });

    it('should convert user message with base64 image string', () => {
      const prompt: LanguageModelV2Prompt = [
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Describe this image' },
            { type: 'image', image: 'data:image/jpeg;base64,/9j/4AAQ...' },
          ],
        },
      ];

      const result = convertToOllamaChatMessages(prompt);

      expect(result).toEqual([
        {
          role: 'user',
          content: 'Describe this image',
          images: ['data:image/jpeg;base64,/9j/4AAQ...'],
        },
      ]);
    });

    it('should convert user message with Uint8Array image', () => {
      const imageData = new Uint8Array([255, 216, 255, 224]); // JPEG header
      const prompt: LanguageModelV2Prompt = [
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Analyze this image' },
            { type: 'image', image: imageData },
          ],
        },
      ];

      const result = convertToOllamaChatMessages(prompt);

      expect(result).toEqual([
        {
          role: 'user',
          content: 'Analyze this image',
          images: [`data:image/jpeg;base64,${Buffer.from(imageData).toString('base64')}`],
        },
      ]);
    });

    it('should convert user message with multiple images', () => {
      const prompt: LanguageModelV2Prompt = [
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Compare these images' },
            { type: 'image', image: new URL('https://example.com/image1.jpg') },
            { type: 'image', image: 'data:image/png;base64,iVBOR...' },
          ],
        },
      ];

      const result = convertToOllamaChatMessages(prompt);

      expect(result).toEqual([
        {
          role: 'user',
          content: 'Compare these images',
          images: [
            'https://example.com/image1.jpg',
            'data:image/png;base64,iVBOR...',
          ],
        },
      ]);
    });

    it('should handle user message with only images', () => {
      const prompt: LanguageModelV2Prompt = [
        {
          role: 'user',
          content: [
            { type: 'image', image: new URL('https://example.com/image.jpg') },
          ],
        },
      ];

      const result = convertToOllamaChatMessages(prompt);

      expect(result).toEqual([
        {
          role: 'user',
          content: '',
          images: ['https://example.com/image.jpg'],
        },
      ]);
    });
  });

  describe('assistant messages', () => {
    it('should convert simple assistant message', () => {
      const prompt: LanguageModelV2Prompt = [
        {
          role: 'assistant',
          content: 'I am doing well, thank you!',
        },
      ];

      const result = convertToOllamaChatMessages(prompt);

      expect(result).toEqual([
        {
          role: 'assistant',
          content: 'I am doing well, thank you!',
        },
      ]);
    });

    it('should convert assistant message with text parts', () => {
      const prompt: LanguageModelV2Prompt = [
        {
          role: 'assistant',
          content: [
            { type: 'text', text: 'Here is my response: ' },
            { type: 'text', text: 'This is additional information.' },
          ],
        },
      ];

      const result = convertToOllamaChatMessages(prompt);

      expect(result).toEqual([
        {
          role: 'assistant',
          content: 'Here is my response: This is additional information.',
        },
      ]);
    });

    it('should convert assistant message with tool calls', () => {
      const prompt: LanguageModelV2Prompt = [
        {
          role: 'assistant',
          content: [
            { type: 'text', text: 'Let me check the weather for you.' },
            {
              type: 'tool-call',
              toolCallId: '123',
              toolName: 'getWeather',
              args: { location: 'New York' },
            },
          ],
        },
      ];

      const result = convertToOllamaChatMessages(prompt);

      expect(result).toEqual([
        {
          role: 'assistant',
          content: 'Let me check the weather for you.\n[Tool Call: getWeather({"location":"New York"})]',
        },
      ]);
    });

    it('should convert assistant message with multiple tool calls', () => {
      const prompt: LanguageModelV2Prompt = [
        {
          role: 'assistant',
          content: [
            {
              type: 'tool-call',
              toolCallId: '1',
              toolName: 'getWeather',
              args: { location: 'NYC' },
            },
            {
              type: 'tool-call',
              toolCallId: '2',
              toolName: 'getTime',
              args: { timezone: 'EST' },
            },
          ],
        },
      ];

      const result = convertToOllamaChatMessages(prompt);

      expect(result).toEqual([
        {
          role: 'assistant',
          content: '[Tool Call: getWeather({"location":"NYC"})]\n[Tool Call: getTime({"timezone":"EST"})]',
        },
      ]);
    });

    it('should handle empty assistant message', () => {
      const prompt: LanguageModelV2Prompt = [
        {
          role: 'assistant',
          content: [],
        },
      ];

      const result = convertToOllamaChatMessages(prompt);

      expect(result).toEqual([
        {
          role: 'assistant',
          content: '',
        },
      ]);
    });
  });

  describe('tool messages', () => {
    it('should convert tool message to user message', () => {
      const prompt: LanguageModelV2Prompt = [
        {
          role: 'tool',
          content: [
            {
              type: 'tool-result',
              toolCallId: '123',
              toolName: 'getWeather',
              result: { temperature: 72, condition: 'sunny' },
            },
          ],
        },
      ];

      const result = convertToOllamaChatMessages(prompt);

      expect(result).toEqual([
        {
          role: 'user',
          content: '[Tool Result for getWeather]: {"temperature":72,"condition":"sunny"}',
        },
      ]);
    });

    it('should handle tool message with string result', () => {
      const prompt: LanguageModelV2Prompt = [
        {
          role: 'tool',
          content: [
            {
              type: 'tool-result',
              toolCallId: '456',
              toolName: 'getTime',
              result: '2:30 PM EST',
            },
          ],
        },
      ];

      const result = convertToOllamaChatMessages(prompt);

      expect(result).toEqual([
        {
          role: 'user',
          content: '[Tool Result for getTime]: "2:30 PM EST"',
        },
      ]);
    });
  });

  describe('complex conversations', () => {
    it('should convert complete conversation', () => {
      const prompt: LanguageModelV2Prompt = [
        {
          role: 'system',
          content: 'You are a helpful assistant.',
        },
        {
          role: 'user',
          content: 'What is the weather like?',
        },
        {
          role: 'assistant',
          content: [
            { type: 'text', text: 'Let me check that for you.' },
            {
              type: 'tool-call',
              toolCallId: '1',
              toolName: 'getWeather',
              args: { location: 'current' },
            },
          ],
        },
        {
          role: 'tool',
          content: [
            {
              type: 'tool-result',
              toolCallId: '1',
              toolName: 'getWeather',
              result: { temp: 75, condition: 'partly cloudy' },
            },
          ],
        },
        {
          role: 'assistant',
          content: 'The weather is 75°F and partly cloudy.',
        },
      ];

      const result = convertToOllamaChatMessages(prompt);

      expect(result).toEqual([
        {
          role: 'system',
          content: 'You are a helpful assistant.',
        },
        {
          role: 'user',
          content: 'What is the weather like?',
        },
        {
          role: 'assistant',
          content: 'Let me check that for you.\n[Tool Call: getWeather({"location":"current"})]',
        },
        {
          role: 'user',
          content: '[Tool Result for getWeather]: {"temp":75,"condition":"partly cloudy"}',
        },
        {
          role: 'assistant',
          content: 'The weather is 75°F and partly cloudy.',
        },
      ]);
    });
  });

  describe('error handling', () => {
    it('should throw error for unsupported message role', () => {
      const prompt = [
        {
          role: 'unknown',
          content: 'This should fail',
        },
      ] as Parameters<typeof convertToOllamaChatMessages>[0];

      expect(() => convertToOllamaChatMessages(prompt)).toThrow('Unsupported message role: unknown');
    });
  });

  describe('edge cases', () => {
    it('should handle empty prompt', () => {
      const prompt: LanguageModelV2Prompt = [];
      const result = convertToOllamaChatMessages(prompt);
      expect(result).toEqual([]);
    });

    it('should handle mixed content types properly', () => {
      const prompt: LanguageModelV2Prompt = [
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Hello' },
            { type: 'image', image: 'data:image/jpeg;base64,abc123' },
            { type: 'text', text: 'World' },
          ],
        },
      ];

      const result = convertToOllamaChatMessages(prompt);

      expect(result).toEqual([
        {
          role: 'user',
          content: 'Hello\nWorld',
          images: ['data:image/jpeg;base64,abc123'],
        },
      ]);
    });
  });
});