import { ollama } from 'ai-sdk-ollama';
import { streamText, tool } from 'ai';
import { z } from 'zod';
import { MODELS } from './model';

async function testToolCallingWithModel(modelName: string) {
  console.log(`\n🔧 Testing tool calling with ${modelName}`);
  console.log('-'.repeat(60));

  try {
    const { textStream, toolCalls } = await streamText({
      model: ollama(modelName),
      prompt: 'What is the weather in San Francisco? Use the weather tool.',
      tools: {
        getWeather: tool({
          description: 'Get weather for a city',
          inputSchema: z.object({
            city: z.string().describe('City name'),
            unit: z.enum(['celsius', 'fahrenheit']).optional(),
          }),
          execute: async ({ city, unit = 'celsius' }) => {
            console.log(`  🌡️  Tool executed for ${city} in ${unit}`);
            return {
              city,
              temperature: 18,
              unit,
              condition: 'foggy',
            };
          },
        }),
      },
    });

    console.log('Response: ');
    let fullResponse = '';
    for await (const chunk of textStream) {
      process.stdout.write(chunk);
      fullResponse += chunk;
    }

    // Await the toolCalls promise
    const finalToolCalls = await toolCalls;
    console.log('\n🔧 Tool calls:', finalToolCalls?.length || 0);

    if (finalToolCalls && finalToolCalls.length > 0) {
      for (const toolCall of finalToolCalls) {
        console.log(`   ✅ ${toolCall.toolName}:`, toolCall.input);
      }
      console.log(`   ✅ ${modelName} SUPPORTS tool calling`);
    } else {
      console.log(`   ❌ ${modelName} did NOT make any tool calls`);
      console.log(`   📝 Response length: ${fullResponse.length} chars`);
    }

    return { success: true, toolCalls: finalToolCalls?.length || 0 };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.log(`   ❌ ${modelName} failed: ${errorMessage}`);
    return { success: false, error: errorMessage };
  }
}

async function runToolCallingTests() {
  console.log('🧪 Tool Calling Compatibility Test');
  console.log('='.repeat(60));

  const modelsToTest = [
    MODELS.LLAMA_3_2,
    MODELS.PHI4_MINI,
    MODELS.GTP_OSS_20B,
    MODELS.QWEN_2_5_CODER,
  ];

  const results: Record<string, any> = {};

  for (const modelName of modelsToTest) {
    const result = await testToolCallingWithModel(modelName);
    results[modelName] = result;
  }

  console.log('\n' + '='.repeat(60));
  console.log('📊 SUMMARY - Tool Calling Support');
  console.log('='.repeat(60));

  for (const [modelName, result] of Object.entries(results)) {
    if (result.success) {
      const status = result.toolCalls > 0 ? '✅ SUPPORTS' : '❌ NO TOOLS';
      console.log(`${status} ${modelName} (${result.toolCalls} calls)`);
    } else {
      console.log(`❌ ERROR   ${modelName} - ${result.error}`);
    }
  }
}

// Run the test
runToolCallingTests().catch(console.error);