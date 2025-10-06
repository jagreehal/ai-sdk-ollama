import { generateText as aiGenerateText, tool, Output } from 'ai';
import { ollama, generateText as ollamaGenerateText } from 'ai-sdk-ollama';
import { z } from 'zod';

const weatherTool = tool({
  description: 'Get current weather for a location',
  inputSchema: z.object({
    location: z.string().describe('City name'),
  }),
  execute: async ({ location }: { location: string }) => {
    return {
      location,
      temperature: 22,
      condition: 'sunny',
      humidity: 60,
    };
  },
});

async function testAiSdkGenerateText() {
  console.log('Testing with ai SDK generateText...');

  // This should work without `as any`
  const result = await aiGenerateText({
    model: ollama('llama3.2'),
    prompt: 'Test',
    tools: {
      getWeather: weatherTool, // No as any needed
    },
  });

  console.log('✅ ai SDK generateText works without type cast');
  console.log('Tool calls:', result.toolCalls.length);
}

async function testOllamaGenerateText() {
  console.log('\nTesting with ai-sdk-ollama generateText...');

  // Check if this needs `as any`
  const result = await ollamaGenerateText({
    model: ollama('llama3.2'),
    prompt: 'Test',
    tools: {
      getWeather: weatherTool, // Does this need as any?
    },
  });

  console.log('✅ ai-sdk-ollama generateText works without type cast');
  console.log('Tool calls:', result.toolCalls.length);
}

async function main() {
  await testAiSdkGenerateText();
  await testOllamaGenerateText();
}

main().catch(console.error);
