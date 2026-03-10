import { Output, tool } from 'ai';
import { ollama, generateText } from 'ai-sdk-ollama';
import { z } from 'zod';

async function main() {
  console.log('🚀 Testing ENHANCED Tool Calling with Structured Output\n');
  console.log('This is an ai-sdk-ollama exclusive feature!\n');
  console.log('='.repeat(70));

  const weatherTool = tool({
    description: 'Get current weather for a location',
    inputSchema: z.object({
      location: z.string().describe('City name'),
    }),
    execute: async ({ location }: { location: string }) => {
      console.log(`   🌤️  Weather tool called for: ${location}`);
      return {
        location,
        temperature: 22,
        condition: 'sunny',
        humidity: 60,
      };
    },
  });

  const prompt = 'Get the weather for San Francisco and provide a structured summary';
  const tools = { getWeather: weatherTool as any }; // Type assertion needed due to AI SDK ToolSet type restrictions
  const experimentalOutput = Output.object({
    schema: z.object({
      location: z.string(),
      temperature: z.number(),
      condition: z.string(),
      summary: z.string(),
      recommendation: z.string(),
      shouldBringUmbrella: z.boolean(),
    }),
  });

  // Test 1: Standard AI SDK behavior (tools are bypassed)
  console.log('\n📌 Test 1: Standard behavior (no enhancement)');
  console.log('toolChoice: "required" + output');
  const result1 = await generateText({
    model: ollama('llama3.2'),
    prompt,
    tools,
    output: experimentalOutput,
    toolChoice: 'required',
    // NO enhancedOptions - uses official AI SDK behavior
  });

  console.log('✅ Tool calls:', result1.toolCalls?.length || 0);
  console.log('✅ Has actual weather data:', result1.output.temperature !== 0);
  console.log('   Result:', JSON.stringify(result1.output, null, 2));

  // Test 2: Enhanced behavior (ai-sdk-ollama exclusive!)
  console.log('\n📌 Test 2: ENHANCED behavior (opt-in)');
  console.log('toolChoice: "required" + output + enableToolsWithStructuredOutput');
  const result2 = await generateText({
    model: ollama('llama3.2'),
    prompt,
    tools,
    output: experimentalOutput,
    toolChoice: 'required',
    enhancedOptions: {
      enableToolsWithStructuredOutput: true, // ⚡ Enable the magic!
    },
  });

  console.log('✅ Tool calls:', result2.toolCalls?.length || 0);
  console.log('✅ Tool results:', result2.toolResults?.length || 0);
  console.log('✅ Has actual weather data:', result2.output.temperature === 22);
  console.log('   Result:', JSON.stringify(result2.output, null, 2));

  console.log('\n' + '='.repeat(70));
  console.log('🎯 Comparison:');
  console.log(`   Standard: ${result1.toolCalls?.length || 0} tool calls, temp: ${result1.output.temperature}`);
  console.log(`   Enhanced: ${result2.toolCalls?.length || 0} tool calls, temp: ${result2.output.temperature}`);
  console.log('\n💡 The enhanced mode actually calls the tool and uses real data!');
  console.log('   This is ONLY available in ai-sdk-ollama.');
  console.log('='.repeat(70));
}

main().catch((error) => {
  console.error('Test failed:', error);
  process.exit(1);
});
