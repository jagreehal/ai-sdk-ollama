// Minimal test to isolate the streaming issue
import { ollama } from 'ai-sdk-ollama';

async function minimalStreamTest() {
  console.log('🧪 Minimal streaming test...');

  try {
    // Use dynamic import to avoid potential conflicts
    const { streamText, tool } = await import('ai');
    const { z } = await import('zod');

    const result = await streamText({
      model: ollama('gpt-oss:20b'),
      prompt: 'What is the weather in San Francisco? Use the weather tool.',
      tools: {
        getWeather: tool({
          description: 'Get weather for a city',
          inputSchema: z.object({
            city: z.string().describe('City name'),
          }),
          execute: async ({ city }) => {
            console.log(`Tool executed for ${city}`);
            return { city, temperature: 18, condition: 'foggy' };
          },
        }),
      },
    });

    let text = '';
    for await (const chunk of result.textStream) {
      text += chunk;
    }

    const toolCalls = await result.toolCalls;
    console.log(`Text: "${text}"`);
    console.log(`Tool calls: ${toolCalls?.length || 0}`);

  } catch (error) {
    console.log(`Error: ${error}`);
    throw error;
  }
}

minimalStreamTest().catch((error) => {
  console.error('Minimal stream test failed:', error);
  process.exit(1);
});