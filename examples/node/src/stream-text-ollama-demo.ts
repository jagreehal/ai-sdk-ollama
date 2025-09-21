/**
 * Stream Text Ollama Demo
 * 
 * This example demonstrates the streamTextOllama function which provides
 * enhanced text streaming with reliability features for Ollama models.
 * 
 * The function wraps the AI SDK's streamText with additional reliability
 * features including better stop conditions and response synthesis.
 */

import { ollama } from 'ai-sdk-ollama';
import { streamTextOllama } from 'ai-sdk-ollama';
import { z } from 'zod';

// Mock tools for demonstration
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

async function demoStreamTextOllama() {
  console.log('🎯 Stream Text Ollama Demo\n');
  console.log('This demo shows how to use streamTextOllama for reliable text streaming.\n');
  console.log('='.repeat(70));

  // Test 1: Basic Text Streaming
  console.log('\n📌 Test 1: Basic Text Streaming');
  console.log('Streaming a simple text response with reliability features\n');

  try {
    const streamResult = await streamTextOllama({
      model: ollama('llama3.2'),
      prompt: 'Write a short story about a robot learning to paint. Make it creative and engaging.',
      enhancedOptions: {
        enableReliability: true,
        maxSteps: 3,
        minResponseLength: 50,
      },
    });

    console.log('✅ Streaming Text Response:');
    console.log('Streaming content...\n');
    
    let fullText1 = '';
    for await (const chunk of streamResult.textStream) {
      process.stdout.write(chunk);
      fullText1 += chunk;
    }
    
    console.log('\n\n📊 Stream Statistics:');
    console.log(`- Total length: ${fullText1.length} characters`);
    console.log(`- Finish reason: ${streamResult.finishReason}`);
    console.log(`- Usage: ${JSON.stringify(streamResult.usage, null, 2)}`);
    
  } catch (error) {
    console.log('❌ Error:', error instanceof Error ? error.message : String(error));
  }

  // Test 2: Streaming with Tools
  console.log('\n' + '='.repeat(70));
  console.log('\n📌 Test 2: Streaming with Tool Calls');
  console.log('Streaming text that includes tool calls for weather information\n');

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

  try {
    const toolStreamResult = await streamTextOllama({
      model: ollama('llama3.2'),
      prompt: 'What is the weather in San Francisco? Please provide a detailed response.',
      tools: { get_weather: weatherTool },
      enhancedOptions: {
        enableReliability: true,
        maxSteps: 5,
        minResponseLength: 30,
      },
    });

    console.log('✅ Streaming with Tool Calls:');
    console.log('Streaming content...\n');
    
    let fullText2 = '';
    for await (const chunk of toolStreamResult.textStream) {
      process.stdout.write(chunk);
      fullText2 += chunk;
    }
    
    console.log('\n\n📊 Tool Stream Statistics:');
    console.log(`- Total length: ${fullText2.length} characters`);
    const toolCalls2 = await toolStreamResult.toolCalls;
    const toolResults2 = await toolStreamResult.toolResults;
    console.log(`- Tool calls: ${toolCalls2?.length || 0}`);
    console.log(`- Tool results: ${toolResults2?.length || 0}`);
    console.log(`- Finish reason: ${toolStreamResult.finishReason}`);
    
  } catch (error) {
    console.log('❌ Error:', error instanceof Error ? error.message : String(error));
  }

  // Test 3: Multiple Tool Calls
  console.log('\n' + '='.repeat(70));
  console.log('\n📌 Test 3: Multiple Tool Calls');
  console.log('Streaming text that uses multiple tools\n');

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
    const multiToolStreamResult = await streamTextOllama({
      model: ollama('llama3.2'),
      prompt: 'What is the weather in Tokyo and search for information about Tokyo tourism. Then provide a comprehensive summary.',
      tools: {
        get_weather: weatherTool,
        search_web: searchTool,
      },
      enhancedOptions: {
        enableReliability: true,
        maxSteps: 8,
        minResponseLength: 100,
      },
    });

    console.log('✅ Multiple Tool Calls Stream:');
    console.log('Streaming content...\n');
    
    let fullText3 = '';
    for await (const chunk of multiToolStreamResult.textStream) {
      process.stdout.write(chunk);
      fullText3 += chunk;
    }
    
    console.log('\n\n📊 Multi-Tool Stream Statistics:');
    console.log(`- Total length: ${fullText3.length} characters`);
    const toolCalls3 = await multiToolStreamResult.toolCalls;
    const toolResults3 = await multiToolStreamResult.toolResults;
    console.log(`- Tool calls: ${toolCalls3?.length || 0}`);
    console.log(`- Tool results: ${toolResults3?.length || 0}`);
    console.log(`- Finish reason: ${multiToolStreamResult.finishReason}`);
    
  } catch (error) {
    console.log('❌ Error:', error instanceof Error ? error.message : String(error));
  }

  // Test 4: Reliability Comparison
  console.log('\n' + '='.repeat(70));
  console.log('\n📌 Test 4: Reliability Comparison');
  console.log('Comparing streaming with and without reliability features\n');

  // Without reliability
  console.log('\n🔴 Without Reliability Features:');
  try {
    const unreliableStreamResult = await streamTextOllama({
      model: ollama('llama3.2'),
      prompt: 'Write a haiku about programming.',
      enhancedOptions: {
        enableReliability: false,
      },
    });

    console.log('Streaming content...\n');
    
    let fullText4 = '';
    for await (const chunk of unreliableStreamResult.textStream) {
      process.stdout.write(chunk);
      fullText4 += chunk;
    }
    
    console.log(`\n- Total length: ${fullText4.length} characters`);
    console.log(`- Finish reason: ${unreliableStreamResult.finishReason}`);
    
  } catch (error) {
    console.log('❌ Error:', error instanceof Error ? error.message : String(error));
  }

  // With reliability
  console.log('\n🟢 With Reliability Features:');
  try {
    const reliableStreamResult = await streamTextOllama({
      model: ollama('llama3.2'),
      prompt: 'Write a haiku about programming.',
      enhancedOptions: {
        enableReliability: true,
        maxSteps: 3,
        minResponseLength: 20,
      },
    });

    console.log('Streaming content...\n');
    
    let fullText5 = '';
    for await (const chunk of reliableStreamResult.textStream) {
      process.stdout.write(chunk);
      fullText5 += chunk;
    }
    
    console.log(`\n- Total length: ${fullText5.length} characters`);
    console.log(`- Finish reason: ${reliableStreamResult.finishReason}`);
    
  } catch (error) {
    console.log('❌ Error:', error instanceof Error ? error.message : String(error));
  }

  // Test 5: Long-form Content Streaming
  console.log('\n' + '='.repeat(70));
  console.log('\n📌 Test 5: Long-form Content Streaming');
  console.log('Streaming a longer piece of content\n');

  try {
    const longStreamResult = await streamTextOllama({
      model: ollama('llama3.2'),
      prompt: 'Write a detailed technical article about the benefits of using TypeScript in web development. Include sections on type safety, developer experience, and performance.',
      enhancedOptions: {
        enableReliability: true,
        maxSteps: 5,
        minResponseLength: 200,
      },
    });

    console.log('✅ Long-form Content Stream:');
    console.log('Streaming content...\n');
    
    let fullText6 = '';
    let chunkCount = 0;
    for await (const chunk of longStreamResult.textStream) {
      process.stdout.write(chunk);
      fullText6 += chunk;
      chunkCount++;
    }
    
    console.log('\n\n📊 Long-form Stream Statistics:');
    console.log(`- Total length: ${fullText6.length} characters`);
    console.log(`- Chunk count: ${chunkCount}`);
    console.log(`- Finish reason: ${longStreamResult.finishReason}`);
    console.log(`- Usage: ${JSON.stringify(longStreamResult.usage, null, 2)}`);
    
  } catch (error) {
    console.log('❌ Error:', error instanceof Error ? error.message : String(error));
  }

  console.log('\n' + '='.repeat(70));
  console.log('\n🎉 Stream Text Ollama Demo Complete!');
  console.log('The streamTextOllama function provides enhanced reliability for text streaming with Ollama models.');
}

// Run the demo
demoStreamTextOllama().catch(console.error);
