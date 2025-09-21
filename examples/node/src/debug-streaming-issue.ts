import { ollama } from 'ai-sdk-ollama';
import { generateText, streamText, tool } from 'ai';
import { z } from 'zod';
import { Ollama } from 'ollama';

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

async function debugStreamingVsGenerate(modelName: string) {
  console.log(`\n🔍 Debugging ${modelName}: Why streaming fails vs generateText`);
  console.log('='.repeat(70));

  const prompt = 'What is the weather in San Francisco? Use the weather tool.';
  const tools = { getWeather: weatherTool };

  try {
    // Test 1: Direct Ollama (we know this works)
    console.log('1️⃣ Direct Ollama:');
    const direct = new Ollama();
    const directResponse = await direct.chat({
      model: modelName,
      messages: [{ role: 'user', content: prompt }],
      tools: [
        {
          type: 'function',
          function: {
            name: 'getWeather',
            description: 'Get weather for a city',
            parameters: {
              type: 'object',
              properties: { city: { type: 'string', description: 'City name' } },
              required: ['city'],
            },
          },
        },
      ],
    });
    console.log(`   Content: "${directResponse.message.content}"`);
    console.log(`   Tool calls: ${directResponse.message.tool_calls?.length || 0}`);

    // Test 2: AI SDK generateText (non-streaming)
    console.log('\n2️⃣ AI SDK generateText:');
    const generateResult = await generateText({
      model: ollama(modelName),
      prompt,
      tools,
    });
    console.log(`   Text: "${generateResult.text}"`);
    console.log(`   Tool calls: ${generateResult.toolCalls?.length || 0}`);

    // Test 3: AI SDK streamText (streaming) - THIS IS WHERE FAILURES HAPPEN
    console.log('\n3️⃣ AI SDK streamText:');
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

    // Compare results
    const directWorks = (directResponse.message.tool_calls?.length || 0) > 0;
    const generateWorks = (generateResult.toolCalls?.length || 0) > 0;
    const streamWorks = (streamToolCalls?.length || 0) > 0;

    console.log('\n📊 Results:');
    console.log(`   Direct Ollama: ${directWorks ? '✅' : '❌'}`);
    console.log(`   AI SDK generate: ${generateWorks ? '✅' : '❌'}`);
    console.log(`   AI SDK stream: ${streamWorks ? '✅' : '❌'}`);

    if (directWorks && !streamWorks) {
      console.log('   🚨 STREAMING BUG DETECTED!');
    }

  } catch (error) {
    console.log(`   ❌ Error: ${error}`);
  }
}

async function runStreamingDebug() {
  console.log('🐛 Debugging Streaming vs Non-Streaming Tool Calls');
  console.log('='.repeat(70));

  const models = ['gpt-oss:20b']; // Focus on the problematic model

  for (const model of models) {
    await debugStreamingVsGenerate(model);
  }
}

runStreamingDebug().catch(console.error);