import { Output, tool } from 'ai';
import { ollama, generateText } from 'ai-sdk-ollama';
import { z } from 'zod';

async function main() {
  console.log('Testing experimental_output with new types...\n');
  console.log('='.repeat(70));

  try {
    // Test 1: Using experimental_output with generateText (no tools)
    console.log('\nTest 1: experimental_output without tools');
    const result1 = await generateText({
      model: ollama('llama3.2'),
      prompt: 'Generate a simple greeting message with a number from 1-10 for enthusiasm level',
      experimental_output: Output.object({
        schema: z.object({
          greeting: z.string(),
          enthusiasm: z.number().min(1).max(10),
        }),
      }),
    });

    console.log('Result:', result1.experimental_output);
    console.log('   Type - greeting:', typeof result1.experimental_output.greeting);
    console.log('   Type - enthusiasm:', typeof result1.experimental_output.enthusiasm);

    // Test 2: Using experimental_output WITH tools
    console.log('\nTest 2: experimental_output WITH tool calling');

    const weatherTool = tool({
      description: 'Get current weather for a location',
      inputSchema: z.object({
        location: z.string().describe('City name'),
      }),
      execute: async ({ location }: { location: string }) => {
        console.log(`   Weather tool called for: ${location}`);
        return {
          location,
          temperature: 22,
          condition: 'sunny',
          humidity: 60,
        };
      },
    });

    let result2;
    try {
      result2 = await generateText({
        model: ollama('llama3.2'),
        prompt:
          'Get the weather for San Francisco and provide a structured summary',
        tools: {
          getWeather: weatherTool as any, // Type assertion needed due to AI SDK ToolSet type restrictions
        },
        experimental_output: Output.object({
          schema: z.object({
            location: z.string(),
            summary: z.string(),
            recommendation: z.string(),
            shouldBringUmbrella: z.boolean(),
          }),
        }),
        toolChoice: 'required',
      });

      console.log('Tool calls:', result2.toolCalls.length);
      console.log('Result:', result2.experimental_output);
      console.log('   Type - location:', typeof result2.experimental_output.location);
      console.log('   Type - summary:', typeof result2.experimental_output.summary);
      console.log('   Type - recommendation:', typeof result2.experimental_output.recommendation);
      console.log('   Type - shouldBringUmbrella:', typeof result2.experimental_output.shouldBringUmbrella);
    } catch (error) {
      console.log('Tool calls: ERROR -', error instanceof Error ? error.message : String(error));
      console.log('Result: ERROR - Could not generate structured output');
      result2 = { toolCalls: [], experimental_output: null };
    }

    // Test 3: Tool calling WITHOUT experimental_output (to verify tool works)
    console.log('\nTest 3: Tool calling WITHOUT experimental_output');
    const result3 = await generateText({
      model: ollama('llama3.2'),
      prompt:
        'Get the weather for San Francisco and provide a structured summary',
      tools: {
        getWeather: weatherTool as any, // Type assertion needed due to AI SDK ToolSet type restrictions
      },
        toolChoice: 'required',
    });

    // Await promises to get actual values
    const toolCalls = await result3.toolCalls;
    const toolResults = await result3.toolResults;

    console.log('Tool calls (awaited):', toolCalls?.length || 0);
    console.log('Tool results (awaited):', toolResults?.length || 0);
    console.log('Text response length:', result3.text.length);
    console.log('Full result keys:', Object.keys(result3));

    if (toolCalls && toolCalls.length > 0) {
      console.log('Tool was called successfully!');
      console.log('   Tool calls:', toolCalls);
      console.log('   Tool results:', toolResults);
    } else {
      console.log('Tool calls array is empty or missing after awaiting');
      console.log('   ai-sdk-ollama synthesis is not preserving tool metadata');
    }

    console.log('\n' + '='.repeat(70));
    console.log('All tests completed');
    console.log('='.repeat(70));
  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  }
}

main().catch((error) => {
  console.error('Test experimental output failed:', error);
  process.exit(1);
});
