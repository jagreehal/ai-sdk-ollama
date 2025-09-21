/**
 * Tool Calling Demo
 * 
 * This example demonstrates both the reliability issues with Ollama tool calling
 * and the solutions to make it more reliable and deterministic. It shows how
 * the built-in reliability features work with the AI SDK's existing tool calling patterns.
 * 
 * The AI SDK automatically handles the tool calling loop with generateText.
 * The reliability features enhance this process by improving parameter normalization,
 * adding retry logic, and ensuring complete responses.
 * 
 * Run this example multiple times to see the consistent behavior.
 */

import { ollama } from 'ai-sdk-ollama';
import { generateText } from 'ai';
import { z } from 'zod';
import { generateTextOllama } from 'ai-sdk-ollama';

// Mock tools
async function getWeather(location: string, unit: string = 'celsius') {
  const temps: Record<string, { celsius: number; fahrenheit: number }> = {
    'San Francisco': { celsius: 18, fahrenheit: 64 },
    'New York': { celsius: 22, fahrenheit: 72 },
    London: { celsius: 15, fahrenheit: 59 },
    Tokyo: { celsius: 26, fahrenheit: 79 },
  };

  const weather = temps[location] || { celsius: 20, fahrenheit: 68 };
  return {
    location,
    temperature: weather[unit as keyof typeof weather],
    unit,
    condition: 'Partly cloudy',
    humidity: 65,
  };
}

async function searchWeb(query: string) {
  return {
    query,
    results: [
      { title: `Search result for: ${query}`, url: 'https://example.com/1' },
      { title: `Another result for: ${query}`, url: 'https://example.com/2' },
    ],
  };
}

// Helper function to demonstrate the AI SDK's automatic tool calling
async function demonstrateToolCalling(options: {
  prompt: string;
  tools: any;
  reliabilityEnabled?: boolean;
  toolCallingOptions?: any;
}) {
  const { prompt, tools, reliabilityEnabled = true, toolCallingOptions } = options;
  
  console.log(`\n${reliabilityEnabled ? '🟢' : '🔴'} AI SDK Tool Calling (reliability ${reliabilityEnabled ? 'enabled' : 'disabled'})`);
  
  const result = await generateText({
    model: ollama('llama3.2', {
      reliableToolCalling: reliabilityEnabled,
      toolCallingOptions: toolCallingOptions,
    }),
    prompt,
    tools,
  });

  return result;
}

async function demoToolCalling() {
  console.log('🎯 Comprehensive Tool Calling Demo\n');
  console.log('This demo shows the reliability issues with Ollama and the solutions.\n');
  console.log('='.repeat(70));

  // Test 1: Single Tool - Regular vs Reliable
  console.log('\n📌 Test 1: Single Tool Call');
  console.log('Comparing regular tool calling vs reliable tool calling\n');

  const weatherTool = {
    description: 'Get the current weather for a location',
    inputSchema: z.object({
      location: z.string().describe('The city name'),
      unit: z.enum(['celsius', 'fahrenheit']).optional(),
    }),
    execute: async (params: Record<string, unknown>) => {
      const location = params.location as string;
      const unit = (params.unit as string) || 'celsius';
      return await getWeather(location, unit);
    },
  };

  // Tool calling without reliability features
  console.log('🔴 Tool Calling (reliability disabled):');
  try {
    const unreliableResult = await demonstrateToolCalling({
      prompt: 'What is the weather in San Francisco?',
      tools: { get_weather: weatherTool },
      reliabilityEnabled: false,
    });

    console.log(`- Response length: ${unreliableResult.text.length}`);
    console.log(`- Tool calls: ${unreliableResult.toolCalls?.length || 0}`);
    console.log(`- Response: ${unreliableResult.text || '(EMPTY - This is the problem!)'}`);
    
  } catch (error) {
    console.log('Error:', error instanceof Error ? error.message : String(error));
  }

  // Tool calling with reliability features (default behavior)
  console.log('\n🟢 Tool Calling (reliability enabled - default):');
  try {
    const reliableResult = await demonstrateToolCalling({
      prompt: 'What is the weather in San Francisco?',
      tools: { get_weather: weatherTool },
      reliabilityEnabled: true,
    });

    console.log(`- Response length: ${reliableResult.text.length}`);
    console.log(`- Tool calls: ${reliableResult.toolCalls?.length || 0}`);
    console.log(`- Response: ${reliableResult.text.substring(0, 150)}${reliableResult.text.length > 150 ? '...' : ''}`);
    
  } catch (error) {
    console.log('Error:', error instanceof Error ? error.message : String(error));
  }

  // Test 2: Multiple Tools
  console.log('\n' + '='.repeat(70));
  console.log('\n📌 Test 2: Multiple Tool Calls');
  console.log('Testing multiple tools with synthesis\n');

  const searchTool = {
    description: 'Search the web for information',
    inputSchema: z.object({
      query: z.string().describe('The search query'),
    }),
    execute: async (params: Record<string, unknown>) => {
      const query = params.query as string;
      return await searchWeb(query);
    },
  };

  try {
    const multiResult = await demonstrateToolCalling({
      prompt: 'What is the weather in Tokyo and search for information about Tokyo tourism. Then provide a comprehensive summary.',
      tools: {
        get_weather: weatherTool,
        search_web: searchTool,
      },
      reliabilityEnabled: true,
    });

    console.log(`- Response length: ${multiResult.text.length}`);
    console.log(`- Tool calls: ${multiResult.toolCalls?.length || 0}`);
    console.log(`- Response: ${multiResult.text.substring(0, 200)}${multiResult.text.length > 200 ? '...' : ''}`);
    
  } catch (error) {
    console.log('Error:', error instanceof Error ? error.message : String(error));
  }

  // Test 3: Parameter Normalization
  console.log('\n' + '='.repeat(70));
  console.log('\n📌 Test 3: Parameter Normalization');
  console.log('Testing how the system handles different parameter names\n');

  try {
    const normResult = await demonstrateToolCalling({
      prompt: 'Get the weather for New York in fahrenheit',
      tools: { get_weather: weatherTool },
      reliabilityEnabled: true,
    });

    console.log(`- Response length: ${normResult.text.length}`);
    console.log(`- Tool calls: ${normResult.toolCalls?.length || 0}`);
    console.log(`- Response: ${normResult.text.substring(0, 150)}${normResult.text.length > 150 ? '...' : ''}`);
    
  } catch (error) {
    console.log('Error:', error instanceof Error ? error.message : String(error));
  }

  // Test 4: Enhanced Tool Calling with Force Completion
  console.log('\n' + '='.repeat(70));
  console.log('\n📌 Test 4: Enhanced Tool Calling with Force Completion');
  console.log('Testing the enhanced approach that implements force completion\n');

  try {
    const enhancedResult = await generateTextOllama(
      {
        model: ollama('llama3.2'),
        prompt: 'What is the weather in London?',
        tools: { get_weather: weatherTool },
      },
    );

    console.log(`- Response length: ${enhancedResult.text.length}`);
    console.log(`- Tool calls: ${enhancedResult.toolCalls?.length || 0}`);
    console.log(`- Tool results: ${enhancedResult.toolResults?.length || 0}`);
    console.log(`- Success: ${enhancedResult.text.length > 0 ? '✅' : '❌'}`);
    console.log(`- Response: ${enhancedResult.text.substring(0, 200)}${enhancedResult.text.length > 200 ? '...' : ''}`);
    
  } catch (error) {
    console.log(`- Error: ${error instanceof Error ? error.message : String(error)}`);
  }

  // Test 5: Consistency Test
  console.log('\n' + '='.repeat(70));
  console.log('\n📌 Test 5: Consistency Test');
  console.log('Running the same query multiple times to test consistency\n');

  for (let i = 1; i <= 3; i++) {
    console.log(`\nRun ${i}/3:`);
    try {
      const consistencyResult = await generateTextOllama(
        {
          model: ollama('llama3.2'),
          prompt: 'What is the weather in London?',
          tools: { get_weather: weatherTool },
        },
      );

      console.log(`- Response length: ${consistencyResult.text.length}`);
      console.log(`- Success: ${consistencyResult.text.length > 0 ? '✅' : '❌'}`);
      
    } catch (error) {
      console.log(`- Error: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

}

// Run 
demoToolCalling().catch(console.error);
