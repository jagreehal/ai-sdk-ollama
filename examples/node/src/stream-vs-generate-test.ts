import { ollama } from 'ai-sdk-ollama';
import { streamText, generateText, tool } from 'ai';
import { z } from 'zod';

const weatherTool = tool({
  description: 'Get weather for a city',
  inputSchema: z.object({
    city: z.string().describe('City name'),
  }),
  execute: async ({ city }) => {
    console.log(`    🌡️ Tool executed for ${city}`);
    return { city, temperature: 18, condition: 'foggy' };
  },
});

async function testStreamVsGenerate(modelName: string) {
  console.log(`\n🆚 Testing ${modelName}: streamText vs generateText`);
  console.log('='.repeat(70));

  const prompt = 'What is the weather in San Francisco? Use the weather tool.';
  const tools = { getWeather: weatherTool };

  try {
    // Test generateText (non-streaming)
    console.log('1️⃣ generateText (non-streaming):');
    const generateResult = await generateText({
      model: ollama(modelName),
      prompt,
      tools,
    });

    console.log(`   Text: "${generateResult.text}"`);
    console.log(`   Tool calls: ${generateResult.toolCalls?.length || 0}`);
    if (generateResult.toolCalls && generateResult.toolCalls.length > 0) {
      for (const call of generateResult.toolCalls) {
        console.log(`     - ${call.toolName}:`, call.input);
      }
    }

    // Test streamText
    console.log('\n2️⃣ streamText (streaming):');
    const { textStream, toolCalls } = await streamText({
      model: ollama(modelName),
      prompt,
      tools,
    });

    let accumulatedText = '';
    for await (const chunk of textStream) {
      accumulatedText += chunk;
    }

    const streamToolCalls = await toolCalls;
    console.log(`   Text: "${accumulatedText}"`);
    console.log(`   Tool calls: ${streamToolCalls?.length || 0}`);
    if (streamToolCalls && streamToolCalls.length > 0) {
      for (const call of streamToolCalls) {
        console.log(`     - ${call.toolName}:`, call.input);
      }
    }

    return {
      generate: { text: generateResult.text, toolCalls: generateResult.toolCalls?.length || 0 },
      stream: { text: accumulatedText, toolCalls: streamToolCalls?.length || 0 }
    };

  } catch (error) {
    console.log(`   ❌ Error: ${error}`);
    return { error: String(error) };
  }
}

async function runComparison() {
  console.log('🧪 Streaming vs Non-Streaming Tool Calling Test');
  console.log('='.repeat(70));

  const models = ['llama3.2', 'gpt-oss:20b'];

  for (const model of models) {
    await testStreamVsGenerate(model);
  }
}

runComparison().catch(console.error);