import { describe, it, expect } from 'vitest';
import { generateText, streamText } from 'ai';
import { ollama } from '../index';

describe('Multimodal Integration Tests', { timeout: 120_000 }, () => {
  it('should handle text and image content in messages', async () => {
    // Create a simple test image (1x1 red pixel)
    const redPixel = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==',
      'base64',
    );

    const result = await generateText({
      model: ollama('llava'),
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: 'What color is this image?' },
            { type: 'image', image: redPixel },
          ],
        },
      ],
      maxOutputTokens: 100,
      temperature: 0,
    });

    expect(result.text).toBeTruthy();
    expect(typeof result.text).toBe('string');
    // The response should mention color
    expect(result.text.toLowerCase()).toMatch(/color|red|pixel|image/);
  });

  it('should handle image URLs in content', async () => {
    const result = await generateText({
      model: ollama('llava'),
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Describe this image URL format' },
            {
              type: 'image',
              image: new URL(
                'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
              ),
            },
          ],
        },
      ],
      maxOutputTokens: 100,
      temperature: 0,
    });

    expect(result.text).toBeTruthy();
    expect(typeof result.text).toBe('string');
  });

  it('should stream multimodal content', async () => {
    const blackPixel = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
      'base64',
    );

    const result = await streamText({
      model: ollama('llava'),
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Is this a dark or light image?' },
            { type: 'image', image: blackPixel },
          ],
        },
      ],
      maxOutputTokens: 100,
      temperature: 0,
    });

    const chunks: string[] = [];
    for await (const chunk of result.textStream) {
      chunks.push(chunk);
    }

    const fullText = chunks.join('');
    expect(fullText).toBeTruthy();
    expect(chunks.length).toBeGreaterThan(0);
  });
});
