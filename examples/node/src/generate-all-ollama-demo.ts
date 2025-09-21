/**
 * Comprehensive Ollama Demo
 * 
 * This example demonstrates all the Ollama-specific functions:
 * - generateTextOllama
 * - generateObjectOllama  
 * - streamTextOllama
 * - streamObjectOllama
 * 
 * It shows how each function provides enhanced reliability features
 * for different use cases with Ollama models.
 */

import { ollama } from 'ai-sdk-ollama';
import { 
  generateTextOllama,
  generateObjectOllama,
  streamTextOllama,
  streamObjectOllama
} from 'ai-sdk-ollama';
import { z } from 'zod';

// Define schemas for object generation
const weatherSchema = z.object({
  location: z.string().describe('The city name'),
  temperature: z.number().describe('Temperature in celsius'),
  condition: z.string().describe('Weather condition'),
  humidity: z.number().describe('Humidity percentage'),
  unit: z.enum(['celsius', 'fahrenheit']).describe('Temperature unit'),
});

const personSchema = z.object({
  name: z.string().describe('Full name'),
  age: z.number().describe('Age in years'),
  occupation: z.string().describe('Job title or profession'),
  location: z.string().describe('City and country'),
  interests: z.array(z.string()).describe('List of interests or hobbies'),
});

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

async function comprehensiveDemo() {
  console.log('🎯 Comprehensive Ollama Functions Demo\n');
  console.log('This demo showcases all Ollama-specific functions with reliability features.\n');
  console.log('='.repeat(80));

  // Demo 1: generateTextOllama
  console.log('\n📌 Demo 1: generateTextOllama');
  console.log('Enhanced text generation with tool calling reliability\n');

  try {
    const textResult = await generateTextOllama({
      model: ollama('llama3.2'),
      prompt: 'What is the weather in San Francisco? Please provide a detailed response.',
      tools: { get_weather: weatherTool },
      enhancedOptions: {
        enableReliability: true,
        maxSteps: 5,
        minResponseLength: 30,
      },
    });

    console.log('✅ Text Generation Result:');
    console.log(`- Response length: ${textResult.text.length} characters`);
    console.log(`- Tool calls: ${textResult.toolCalls?.length || 0}`);
    console.log(`- Tool results: ${textResult.toolResults?.length || 0}`);
    console.log(`- Response: ${textResult.text.substring(0, 200)}${textResult.text.length > 200 ? '...' : ''}`);
    
  } catch (error) {
    console.log('❌ Error:', error instanceof Error ? error.message : String(error));
  }

  // Demo 2: generateObjectOllama
  console.log('\n' + '='.repeat(80));
  console.log('\n📌 Demo 2: generateObjectOllama');
  console.log('Enhanced object generation with reliability features\n');

  try {
    const objectResult = await generateObjectOllama({
      model: ollama('llama3.2'),
      prompt: 'Generate weather information for Tokyo. It should be 26 degrees celsius, sunny, with 70% humidity.',
      schema: weatherSchema,
      enhancedOptions: {
        enableReliability: true,
        maxSteps: 3,
        objectReliabilityOptions: {
          maxRetries: 2,
          attemptRecovery: true,
          useFallbacks: true,
        },
      },
    });

    console.log('✅ Object Generation Result:');
    console.log(`- Location: ${objectResult.object.location}`);
    console.log(`- Temperature: ${objectResult.object.temperature}°${objectResult.object.unit}`);
    console.log(`- Condition: ${objectResult.object.condition}`);
    console.log(`- Humidity: ${objectResult.object.humidity}%`);
    console.log(`- Reliability: Success=${objectResult.success}, Retries=${objectResult.retryCount}`);
    
  } catch (error) {
    console.log('❌ Error:', error instanceof Error ? error.message : String(error));
  }

  // Demo 3: streamTextOllama
  console.log('\n' + '='.repeat(80));
  console.log('\n📌 Demo 3: streamTextOllama');
  console.log('Enhanced text streaming with tool calling\n');

  try {
    const streamTextResult1 = await streamTextOllama({
      model: ollama('llama3.2'),
      prompt: 'What is the weather in London? Please provide a detailed response.',
      tools: { get_weather: weatherTool },
      enhancedOptions: {
        enableReliability: true,
        maxSteps: 5,
        minResponseLength: 30,
      },
    });

    console.log('✅ Text Streaming Result:');
    console.log('Streaming content...\n');
    
    let fullText = '';
    for await (const chunk of streamTextResult1.textStream) {
      process.stdout.write(chunk);
      fullText += chunk;
    }
    
    console.log('\n\n📊 Stream Statistics:');
    console.log(`- Total length: ${fullText.length} characters`);
    const toolCalls1 = await streamTextResult1.toolCalls;
    const toolResults1 = await streamTextResult1.toolResults;
    console.log(`- Tool calls: ${toolCalls1?.length || 0}`);
    console.log(`- Tool results: ${toolResults1?.length || 0}`);
    console.log(`- Finish reason: ${streamTextResult1.finishReason}`);
    
  } catch (error) {
    console.log('❌ Error:', error instanceof Error ? error.message : String(error));
  }

  // Demo 4: streamObjectOllama
  console.log('\n' + '='.repeat(80));
  console.log('\n📌 Demo 4: streamObjectOllama');
  console.log('Enhanced object streaming with reliability features\n');

  try {
    const streamObjectResult = await streamObjectOllama({
      model: ollama('llama3.2'),
      prompt: 'Create a profile for a software engineer named Sarah Chen, age 32, living in Seattle, Washington. They are interested in machine learning, hiking, and photography.',
      schema: personSchema,
      enhancedOptions: {
        enableReliability: true,
        maxSteps: 4,
        minResponseLength: 20,
      },
    });

    console.log('✅ Object Streaming Result:');
    console.log('Streaming object parts...\n');
    
    let fullObject = '';
    for await (const chunk of streamObjectResult.partialObjectStream) {
      process.stdout.write(JSON.stringify(chunk, null, 2) + '\n---\n');
      fullObject = JSON.stringify(chunk, null, 2);
    }
    
    console.log('\n📊 Stream Statistics:');
    console.log(`- Final object: ${fullObject}`);
    console.log(`- Finish reason: ${streamObjectResult.finishReason}`);
    
  } catch (error) {
    console.log('❌ Error:', error instanceof Error ? error.message : String(error));
  }

  // Demo 5: Comparison of All Functions
  console.log('\n' + '='.repeat(80));
  console.log('\n📌 Demo 5: Function Comparison');
  console.log('Comparing all four functions with the same prompt\n');

  const testPrompt = 'Generate weather information for New York: 22 degrees celsius, sunny, 45% humidity.';

  // generateTextOllama
  console.log('\n🔤 generateTextOllama:');
  try {
    const textResult = await generateTextOllama({
      model: ollama('llama3.2'),
      prompt: testPrompt,
      enhancedOptions: { enableReliability: true },
    });
    console.log(`- Response length: ${textResult.text.length} characters`);
    console.log(`- Finish reason: ${textResult.finishReason}`);
  } catch (error) {
    console.log('❌ Error:', error instanceof Error ? error.message : String(error));
  }

  // generateObjectOllama
  console.log('\n📦 generateObjectOllama:');
  try {
    const objectResult = await generateObjectOllama({
      model: ollama('llama3.2'),
      prompt: testPrompt,
      schema: weatherSchema,
      enhancedOptions: { enableReliability: true },
    });
    console.log(`- Object: ${JSON.stringify(objectResult.object, null, 2)}`);
    console.log(`- Reliability: Success=${objectResult.success}, Retries=${objectResult.retryCount}`);
  } catch (error) {
    console.log('❌ Error:', error instanceof Error ? error.message : String(error));
  }

  // streamTextOllama
  console.log('\n🌊 streamTextOllama:');
  try {
    const streamTextResult2 = await streamTextOllama({
      model: ollama('llama3.2'),
      prompt: testPrompt,
      enhancedOptions: { enableReliability: true },
    });
    
    let fullText = '';
    for await (const chunk of streamTextResult2.textStream) {
      fullText += chunk;
    }
    console.log(`- Streamed length: ${fullText.length} characters`);
    console.log(`- Finish reason: ${streamTextResult2.finishReason}`);
  } catch (error) {
    console.log('❌ Error:', error instanceof Error ? error.message : String(error));
  }

  // streamObjectOllama
  console.log('\n🌊📦 streamObjectOllama:');
  try {
    const streamObjectResult = await streamObjectOllama({
      model: ollama('llama3.2'),
      prompt: testPrompt,
      schema: weatherSchema,
      enhancedOptions: { enableReliability: true },
    });
    
    let finalObject = null;
    for await (const chunk of streamObjectResult.partialObjectStream) {
      finalObject = chunk;
    }
    console.log(`- Streamed object: ${JSON.stringify(finalObject, null, 2)}`);
    console.log(`- Finish reason: ${streamObjectResult.finishReason}`);
  } catch (error) {
    console.log('❌ Error:', error instanceof Error ? error.message : String(error));
  }

  // Demo 6: Performance and Reliability Summary
  console.log('\n' + '='.repeat(80));
  console.log('\n📌 Demo 6: Performance and Reliability Summary');
  console.log('Key benefits of each function:\n');

  console.log('🔤 generateTextOllama:');
  console.log('  - Enhanced text generation with tool calling reliability');
  console.log('  - Automatic retry logic and parameter normalization');
  console.log('  - Better stop conditions and response synthesis');
  console.log('  - Ideal for: Chat applications, Q&A systems, content generation');

  console.log('\n📦 generateObjectOllama:');
  console.log('  - Structured object generation with schema validation');
  console.log('  - Object reliability features and type mismatch fixing');
  console.log('  - Fallback value generation and schema recovery');
  console.log('  - Ideal for: Data extraction, API responses, structured content');

  console.log('\n🌊 streamTextOllama:');
  console.log('  - Real-time text streaming with reliability features');
  console.log('  - Progressive response delivery with tool calling support');
  console.log('  - Enhanced stop conditions for streaming scenarios');
  console.log('  - Ideal for: Real-time chat, long-form content, interactive applications');

  console.log('\n🌊📦 streamObjectOllama:');
  console.log('  - Real-time object streaming with schema validation');
  console.log('  - Progressive object building with reliability features');
  console.log('  - Enhanced error handling for streaming object generation');
  console.log('  - Ideal for: Real-time data feeds, progressive form filling, live updates');

  console.log('\n' + '='.repeat(80));
  console.log('\n🎉 Comprehensive Ollama Demo Complete!');
  console.log('All Ollama-specific functions provide enhanced reliability and better performance for their respective use cases.');
  console.log('Choose the right function based on your needs:');
  console.log('- Need text? Use generateTextOllama or streamTextOllama');
  console.log('- Need objects? Use generateObjectOllama or streamObjectOllama');
  console.log('- Need real-time? Use streamTextOllama or streamObjectOllama');
  console.log('- Need reliability? All functions include enhanced reliability features!');
}

// Run the comprehensive demo
comprehensiveDemo().catch(console.error);
