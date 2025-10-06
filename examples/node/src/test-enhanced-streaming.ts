import { Output, tool } from 'ai';
import { ollama, streamText } from 'ai-sdk-ollama';
import { z } from 'zod';

async function main() {
  console.log('🚀 Testing ENHANCED streamText with Tool Calling + Structured Output\n');
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
  const tools = { getWeather: weatherTool };
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

  // Test: Enhanced streaming behavior (ai-sdk-ollama exclusive!)
  console.log('\n📌 Testing: toolChoice: "required" + experimental_output + enableToolsWithStructuredOutput');
  console.log('   (Standard AI SDK does NOT support this combination)\n');

  const result = await streamText({
    model: ollama('llama3.2'),
    prompt,
    tools,
    experimental_output: experimentalOutput,
    toolChoice: 'required',
    enhancedOptions: {
      enableToolsWithStructuredOutput: true, // ⚡ Enable the two-phase approach!
    },
  });

  // Consume the stream
  let streamedText = '';
  for await (const chunk of result.textStream) {
    streamedText += chunk;
    process.stdout.write(chunk);
  }
  console.log('\n');

  // Await the final result to get tool metadata
  const finalResult = await result;
  const toolCalls = await finalResult.toolCalls;
  const toolResults = await finalResult.toolResults;

  console.log('✅ Tool calls:', toolCalls?.length || 0);
  console.log('✅ Tool results:', toolResults?.length || 0);

  // NOTE: streamText with experimental_output does NOT expose experimental_output directly
  // You must parse it manually using output.parseOutput() - this is standard AI SDK behavior
  const output = finalResult.output;
  const parsed = await output.parseOutput(
    { text: streamedText },
    {
      response: finalResult.response,
      usage: finalResult.usage,
      finishReason: finalResult.finishReason,
    },
  );

  console.log('✅ Structured output:', JSON.stringify(parsed, null, 2));
  console.log('✅ Has actual weather data:', parsed.temperature === 22);

  console.log('\n' + '='.repeat(70));
  console.log('🎯 Success! The enhanced mode:');
  console.log('   1. Executed tools (Phase 1: generateText with toolChoice)');
  console.log('   2. Generated structured output (Phase 2: streamText with tool results)');
  console.log('   3. Combined both results for complete functionality');
  console.log('\n💡 This two-phase approach is ONLY available in ai-sdk-ollama.');
  console.log('='.repeat(70));
}

main().catch((error) => {
  console.error('Test failed:', error);
  process.exit(1);
});
