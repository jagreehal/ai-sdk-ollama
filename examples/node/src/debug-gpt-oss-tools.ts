import { ollama } from 'ai-sdk-ollama';
import { streamText, tool } from 'ai';
import { z } from 'zod';

async function debugGptOssToolCalling() {
  console.log('🔍 Debugging gpt-oss:20b tool calling');
  console.log('='.repeat(50));

  try {
    console.log('1. Testing basic text generation...');
    const basicResult = await streamText({
      model: ollama('gpt-oss:20b'),
      prompt: 'Say hello world',
      maxOutputTokens: 50,
    });

    let basicText = '';
    for await (const chunk of basicResult.textStream) {
      basicText += chunk;
    }
    console.log(`   ✅ Basic response: "${basicText.trim()}"`);

    console.log('\n2. Testing tool calling...');
    const toolResult = await streamText({
      model: ollama('gpt-oss:20b'),
      prompt: 'What is the weather in San Francisco? Use the weather tool.',
      tools: {
        getWeather: tool({
          description: 'Get weather for a city',
          inputSchema: z.object({
            city: z.string().describe('City name'),
          }),
          execute: async ({ city }) => {
            console.log(`   🔧 Tool executed for: ${city}`);
            return { city, temperature: 18, condition: 'foggy' };
          },
        }),
      },
    });

    let toolText = '';
    for await (const chunk of toolResult.textStream) {
      toolText += chunk;
      process.stdout.write(chunk);
    }

    const finalToolCalls = await toolResult.toolCalls;
    console.log('\n   🔧 Tool calls received:', finalToolCalls?.length || 0);

    if (finalToolCalls && finalToolCalls.length > 0) {
      console.log('   Tool call details:');
      for (const call of finalToolCalls) {
        console.log(`     - ${call.toolName}:`, call.input);
      }
    } else {
      console.log('   ❌ No tool calls detected');
      console.log(`   📝 Response text: "${toolText.trim()}"`);
    }

    console.log('\n3. Testing with a more explicit prompt...');
    const explicitResult = await streamText({
      model: ollama('gpt-oss:20b'),
      prompt: 'I need you to call the getWeather function for San Francisco. Use the available tool.',
      tools: {
        getWeather: tool({
          description: 'Get weather for a city',
          inputSchema: z.object({
            city: z.string().describe('City name'),
          }),
          execute: async ({ city }) => {
            console.log(`   🔧 Tool executed for: ${city}`);
            return { city, temperature: 18, condition: 'foggy' };
          },
        }),
      },
    });

    let explicitText = '';
    for await (const chunk of explicitResult.textStream) {
      explicitText += chunk;
      process.stdout.write(chunk);
    }

    const explicitToolCalls = await explicitResult.toolCalls;
    console.log('\n   🔧 Tool calls received:', explicitToolCalls?.length || 0);

    if (explicitToolCalls && explicitToolCalls.length > 0) {
      console.log('   Tool call details:');
      for (const call of explicitToolCalls) {
        console.log(`     - ${call.toolName}:`, call.input);
      }
    } else {
      console.log('   ❌ Still no tool calls detected');
      console.log(`   📝 Response text: "${explicitText.trim()}"`);
    }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.log(`❌ Error: ${errorMessage}`);
  }
}

debugGptOssToolCalling().catch((error) => {
  console.error('Debug GPT OSS tools failed:', error);
  process.exit(1);
});