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
          content: [{ type: 'text', text: 'Hello, how are you?' }],
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
            {
              type: 'file',
              data: new URL('https://example.com/image.jpg'),
              mediaType: 'image/jpeg',
            },
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
            {
              type: 'file',
              data: 'data:image/jpeg;base64,/9j/4AAQ...',
              mediaType: 'image/jpeg',
            },
          ],
        },
      ];

      const result = convertToOllamaChatMessages(prompt);

      expect(result).toEqual([
        {
          role: 'user',
          content: 'Describe this image',
          images: ['/9j/4AAQ...'],
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
            { type: 'file', data: imageData, mediaType: 'image/jpeg' },
          ],
        },
      ];

      const result = convertToOllamaChatMessages(prompt);

      expect(result).toEqual([
        {
          role: 'user',
          content: 'Analyze this image',
          images: [Buffer.from(imageData).toString('base64')],
        },
      ]);
    });

    it('should convert user message with multiple images', () => {
      const prompt: LanguageModelV2Prompt = [
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Compare these images' },
            {
              type: 'file',
              data: new URL('https://example.com/image1.jpg'),
              mediaType: 'image/jpeg',
            },
            {
              type: 'file',
              data: 'data:image/png;base64,iVBOR...',
              mediaType: 'image/png',
            },
          ],
        },
      ];

      const result = convertToOllamaChatMessages(prompt);

      expect(result).toEqual([
        {
          role: 'user',
          content: 'Compare these images',
          images: ['https://example.com/image1.jpg', 'iVBOR...'],
        },
      ]);
    });

    it('should handle user message with only images', () => {
      const prompt: LanguageModelV2Prompt = [
        {
          role: 'user',
          content: [
            {
              type: 'file',
              data: new URL('https://example.com/image.jpg'),
              mediaType: 'image/jpeg',
            },
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
          content: [{ type: 'text', text: 'I am doing well, thank you!' }],
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
              input: JSON.stringify({ location: 'New York' }),
            },
          ],
        },
      ];

      const result = convertToOllamaChatMessages(prompt);

      expect(result).toEqual([
        {
          role: 'assistant',
          content: 'Let me check the weather for you.\n[Tool Call: getWeather]',
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
              input: JSON.stringify({ location: 'NYC' }),
            },
            {
              type: 'tool-call',
              toolCallId: '2',
              toolName: 'getTime',
              input: JSON.stringify({ timezone: 'EST' }),
            },
          ],
        },
      ];

      const result = convertToOllamaChatMessages(prompt);

      expect(result).toEqual([
        {
          role: 'assistant',
          content: '[Tool Call: getWeather]\n[Tool Call: getTime]',
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
              output: {
                type: 'json',
                value: { temperature: 72, condition: 'sunny' },
              },
            },
          ],
        },
      ];

      const result = convertToOllamaChatMessages(prompt);

      expect(result).toEqual([
        {
          role: 'user',
          content: '[Tool Result]',
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
              output: { type: 'text', value: '2:30 PM EST' },
            },
          ],
        },
      ];

      const result = convertToOllamaChatMessages(prompt);

      expect(result).toEqual([
        {
          role: 'user',
          content: '[Tool Result]',
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
          content: [{ type: 'text', text: 'What is the weather like?' }],
        },
        {
          role: 'assistant',
          content: [
            { type: 'text', text: 'Let me check that for you.' },
            {
              type: 'tool-call',
              toolCallId: '1',
              toolName: 'getWeather',
              input: JSON.stringify({ location: 'current' }),
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
              output: {
                type: 'json',
                value: { temp: 75, condition: 'partly cloudy' },
              },
            },
          ],
        },
        {
          role: 'assistant',
          content: [
            { type: 'text', text: 'The weather is 75°F and partly cloudy.' },
          ],
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
          content: 'Let me check that for you.\n[Tool Call: getWeather]',
        },
        {
          role: 'user',
          content: '[Tool Result]',
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
          role: 'unknown' as never,
          content: 'This should fail',
        },
      ] as Parameters<typeof convertToOllamaChatMessages>[0];

      expect(() => convertToOllamaChatMessages(prompt)).toThrow(
        'Unsupported message role: unknown',
      );
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
            {
              type: 'file',
              data: 'data:image/jpeg;base64,abc123',
              mediaType: 'image/jpeg',
            },
            { type: 'text', text: 'World' },
          ],
        },
      ];

      const result = convertToOllamaChatMessages(prompt);

      expect(result).toEqual([
        {
          role: 'user',
          content: 'Hello\nWorld',
          images: ['abc123'],
        },
      ]);
    });
  });
});
