import { describe, it, expect } from 'vitest';
import { convertToOllamaChatMessages } from './convert-to-ollama-messages';
import { LanguageModelV3Prompt } from '@ai-sdk/provider';

describe('convertToOllamaChatMessages', () => {
  describe('system messages', () => {
    it('should convert system message', () => {
      const prompt: LanguageModelV3Prompt = [
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
      const prompt: LanguageModelV3Prompt = [
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
      const prompt: LanguageModelV3Prompt = [
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
      const prompt: LanguageModelV3Prompt = [
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
      const prompt: LanguageModelV3Prompt = [
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
      const prompt: LanguageModelV3Prompt = [
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
      const prompt: LanguageModelV3Prompt = [
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
      const prompt: LanguageModelV3Prompt = [
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
      const prompt: LanguageModelV3Prompt = [
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
      const prompt: LanguageModelV3Prompt = [
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
      const prompt: LanguageModelV3Prompt = [
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
          content: 'Let me check the weather for you.',
          tool_calls: [
            {
              id: '123',
              type: 'function',
              function: {
                name: 'getWeather',
                arguments: { location: 'New York' },
              },
            },
          ],
        },
      ]);
    });

    it('should convert assistant message with multiple tool calls', () => {
      const prompt: LanguageModelV3Prompt = [
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
          content: '',
          tool_calls: [
            {
              id: '1',
              type: 'function',
              function: {
                name: 'getWeather',
                arguments: { location: 'NYC' },
              },
            },
            {
              id: '2',
              type: 'function',
              function: {
                name: 'getTime',
                arguments: { timezone: 'EST' },
              },
            },
          ],
        },
      ]);
    });

    it('should repair malformed tool-call JSON via parseToolArguments', () => {
      const prompt: LanguageModelV3Prompt = [
        {
          role: 'assistant',
          content: [
            {
              type: 'tool-call',
              toolCallId: 'tc-1',
              toolName: 'search',
              input: '{"query": "weather", "limit": 5,}', // trailing comma
            },
          ],
        },
      ];

      const result = convertToOllamaChatMessages(prompt);

      expect(result).toEqual([
        {
          role: 'assistant',
          content: '',
          tool_calls: [
            {
              id: 'tc-1',
              type: 'function',
              function: {
                name: 'search',
                arguments: { query: 'weather', limit: 5 },
              },
            },
          ],
        },
      ]);
    });

    it('should handle empty assistant message', () => {
      const prompt: LanguageModelV3Prompt = [
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
      const prompt: LanguageModelV3Prompt = [
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
          role: 'tool',
          content: '{"temperature":72,"condition":"sunny"}',
          tool_name: 'getWeather',
        },
      ]);
    });

    it('should handle tool message with string result', () => {
      const prompt: LanguageModelV3Prompt = [
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
          role: 'tool',
          content: '2:30 PM EST',
          tool_name: 'getTime',
        },
      ]);
    });
  });

  describe('complex conversations', () => {
    it('should convert complete conversation', () => {
      const prompt: LanguageModelV3Prompt = [
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
          content: 'What is the weather like?',
          images: undefined,
          role: 'user',
        },
        {
          content: 'Let me check that for you.',
          role: 'assistant',
          tool_calls: [
            {
              id: '1',
              type: 'function',
              function: {
                name: 'getWeather',
                arguments: { location: 'current' },
              },
            },
          ],
        },
        {
          content: '{"temp":75,"condition":"partly cloudy"}',
          role: 'tool',
          tool_name: 'getWeather',
        },
        {
          role: 'assistant',
          content: 'The weather is 75°F and partly cloudy.',
          tool_calls: undefined,
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
      const prompt: LanguageModelV3Prompt = [];
      const result = convertToOllamaChatMessages(prompt);
      expect(result).toEqual([]);
    });

    it('should handle mixed content types properly', () => {
      const prompt: LanguageModelV3Prompt = [
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

  it('should convert user message with ArrayBuffer image', () => {
    const imageData = new Uint8Array([255, 216, 255, 224]); // JPEG header

    const result = convertToOllamaChatMessages([
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Analyze this Uint8Array image' },
          { type: 'file', data: imageData, mediaType: 'image/jpeg' },
        ],
      },
    ]);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      role: 'user',
      content: 'Analyze this Uint8Array image',
      images: [Buffer.from(imageData).toString('base64')],
    });
  });

  it('should convert user message with Node.js Buffer image', () => {
    const imageData = Buffer.from([255, 216, 255, 224]); // JPEG header

    const result = convertToOllamaChatMessages([
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Analyze this Buffer image' },
          { type: 'file', data: imageData, mediaType: 'image/jpeg' },
        ],
      },
    ]);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      role: 'user',
      content: 'Analyze this Buffer image',
      images: [imageData.toString('base64')],
    });
  });

  it('should handle mixed image types in single message', () => {
    const result = convertToOllamaChatMessages([
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Compare these different image formats' },
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
          {
            type: 'file',
            data: new Uint8Array([255, 216, 255, 224]),
            mediaType: 'image/jpeg',
          },
        ],
      },
    ]);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      role: 'user',
      content: 'Compare these different image formats',
      images: [
        'https://example.com/image1.jpg',
        'iVBOR...',
        Buffer.from([255, 216, 255, 224]).toString('base64'),
      ],
    });
  });

  it('should handle assistant message with reasoning', () => {
    const result = convertToOllamaChatMessages([
      {
        role: 'assistant',
        content: [
          { type: 'reasoning', text: 'Let me think about this step by step.' },
          { type: 'text', text: 'The answer is 42.' },
        ],
      },
    ]);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      role: 'assistant',
      content: 'The answer is 42.\nLet me think about this step by step.',
    });
  });

  it('should handle tool message with multi-part content', () => {
    const result = convertToOllamaChatMessages([
      {
        role: 'tool',
        content: [
          {
            type: 'tool-result',
            toolCallId: 'call1',
            toolName: 'weather',
            output: { type: 'text', value: 'Weather data retrieved' },
          },
          {
            type: 'tool-result',
            toolCallId: 'call2',
            toolName: 'weather',
            output: { type: 'text', value: 'Temperature: 72°F' },
          },
        ],
      },
    ]);

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      role: 'tool',
      content: 'Weather data retrieved',
      tool_name: 'weather',
    });
    expect(result[1]).toEqual({
      role: 'tool',
      content: 'Temperature: 72°F',
      tool_name: 'weather',
    });
  });

  it('should handle empty content gracefully', () => {
    const result = convertToOllamaChatMessages([
      {
        role: 'user',
        content: [],
      },
    ]);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      role: 'user',
      content: '',
    });
  });

  it('should handle user message with only images', () => {
    const result = convertToOllamaChatMessages([
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
    ]);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      role: 'user',
      content: '',
      images: ['https://example.com/image.jpg'],
    });
  });
});
