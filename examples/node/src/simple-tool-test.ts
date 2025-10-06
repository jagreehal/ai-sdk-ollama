import { ollama } from 'ai-sdk-ollama';
import { generateText, tool } from 'ai';
import { z } from 'zod';

async function testNonStreamingTools() {
  console.log('🧪 Non-Streaming Tool Test');
  console.log('='.repeat(40));

  const weatherTool = tool({
    description: 'Get weather for a city',
    inputSchema: z.object({
      city: z.string().describe('City name'),
    }),
    execute: async ({ city }) => {
      console.log(`  🌡️ Tool executed for ${city}`);
      return { city, temperature: 18, condition: 'foggy' };
    },
  });

  const models = ['llama3.2', 'gpt-oss:20b'];

  for (const modelName of models) {
    console.log(`\n📋 Testing ${modelName}:`);

    try {
      const result = await generateText({
        model: ollama(modelName),
        prompt: 'What is the weather in San Francisco? Use the weather tool.',
        tools: { getWeather: weatherTool },
      });

      console.log(`   Text: "${result.text}"`);
      console.log(`   Tool calls: ${result.toolCalls?.length || 0}`);

      if (result.toolCalls && result.toolCalls.length > 0) {
        for (const call of result.toolCalls) {
          console.log(`     ✅ ${call.toolName}:`, call.input);
        }
      }

    } catch (error) {
      console.log(`   ❌ Error: ${error}`);
      throw error;
    }
  }
}

testNonStreamingTools().catch((error) => {
  console.error('Tool test failed:', error);
  process.exit(1);
});