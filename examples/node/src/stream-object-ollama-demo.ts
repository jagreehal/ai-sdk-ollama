/**
 * Stream Object Ollama Demo
 * 
 * This example demonstrates the streamObjectOllama function which provides
 * enhanced object streaming with reliability features for Ollama models.
 * 
 * The function wraps the AI SDK's streamObject with additional reliability
 * features including better stop conditions and response synthesis.
 */

import { ollama } from 'ai-sdk-ollama';
import { streamObjectOllama } from 'ai-sdk-ollama';
import { z } from 'zod';

// Define schemas for streaming objects
const weatherSchema = z.object({
  location: z.string().describe('The city name'),
  temperature: z.number().describe('Temperature in celsius'),
  condition: z.string().describe('Weather condition'),
  humidity: z.number().describe('Humidity percentage'),
  unit: z.enum(['celsius', 'fahrenheit']).describe('Temperature unit'),
});

const recipeSchema = z.object({
  name: z.string().describe('Recipe name'),
  ingredients: z.array(z.object({
    name: z.string().describe('Ingredient name'),
    amount: z.string().describe('Amount needed'),
    unit: z.string().describe('Unit of measurement'),
  })).describe('List of ingredients'),
  instructions: z.array(z.string()).describe('Step-by-step cooking instructions'),
  prepTime: z.number().describe('Preparation time in minutes'),
  cookTime: z.number().describe('Cooking time in minutes'),
  servings: z.number().describe('Number of servings'),
});

const productSchema = z.object({
  name: z.string().describe('Product name'),
  price: z.number().describe('Price in USD'),
  category: z.string().describe('Product category'),
  description: z.string().describe('Product description'),
  features: z.array(z.string()).describe('Key product features'),
  specifications: z.record(z.string(), z.string()).describe('Technical specifications'),
  inStock: z.boolean().describe('Whether the product is in stock'),
});

async function demoStreamObjectOllama() {
  console.log('🎯 Stream Object Ollama Demo\n');
  console.log('This demo shows how to use streamObjectOllama for reliable object streaming.\n');
  console.log('='.repeat(70));

  // Test 1: Basic Object Streaming
  console.log('\n📌 Test 1: Basic Weather Object Streaming');
  console.log('Streaming a weather object with reliability features\n');

  try {
    const streamResult = await streamObjectOllama({
      model: ollama('llama3.2'),
      prompt: 'Generate weather information for San Francisco. It should be 18 degrees celsius, partly cloudy, with 65% humidity.',
      schema: weatherSchema,
      enhancedOptions: {
        enableReliability: true,
        maxSteps: 3,
        minResponseLength: 10,
      },
    });

    console.log('✅ Streaming Weather Object:');
    console.log('Streaming object parts...\n');
    
    let fullObject1 = '';
    for await (const chunk of streamResult.partialObjectStream) {
      process.stdout.write(JSON.stringify(chunk, null, 2) + '\n---\n');
      fullObject1 = JSON.stringify(chunk, null, 2);
    }
    
    console.log('\n📊 Stream Statistics:');
    console.log(`- Final object: ${fullObject1}`);
    console.log(`- Finish reason: ${streamResult.finishReason}`);
    console.log(`- Usage: ${JSON.stringify(streamResult.usage, null, 2)}`);
    
  } catch (error) {
    console.log('❌ Error:', error instanceof Error ? error.message : String(error));
  }

  // Test 2: Complex Object with Arrays
  console.log('\n' + '='.repeat(70));
  console.log('\n📌 Test 2: Complex Recipe Object Streaming');
  console.log('Streaming a recipe object with arrays and nested objects\n');

  try {
    const recipeStreamResult = await streamObjectOllama({
      model: ollama('llama3.2'),
      prompt: 'Create a recipe for chocolate chip cookies. Include ingredients like flour, sugar, butter, eggs, and chocolate chips. Provide step-by-step instructions for making the cookies. Prep time should be 15 minutes, cook time 12 minutes, and it should make 24 servings.',
      schema: recipeSchema,
      enhancedOptions: {
        enableReliability: true,
        maxSteps: 5,
        minResponseLength: 50,
      },
    });

    console.log('✅ Streaming Recipe Object:');
    console.log('Streaming object parts...\n');
    
    let fullObject2 = '';
    for await (const chunk of recipeStreamResult.partialObjectStream) {
      process.stdout.write(JSON.stringify(chunk, null, 2) + '\n---\n');
      fullObject2 = JSON.stringify(chunk, null, 2);
    }
    
    console.log('\n📊 Recipe Stream Statistics:');
    console.log(`- Final object: ${fullObject2}`);
    console.log(`- Finish reason: ${recipeStreamResult.finishReason}`);
    
  } catch (error) {
    console.log('❌ Error:', error instanceof Error ? error.message : String(error));
  }

  // Test 3: Object with Record Type
  console.log('\n' + '='.repeat(70));
  console.log('\n📌 Test 3: Product Object with Record Specifications');
  console.log('Streaming a product object with record type for specifications\n');

  try {
    const productStreamResult = await streamObjectOllama({
      model: ollama('llama3.2'),
      prompt: 'Create a product object for a wireless Bluetooth headphones. Price should be $199.99, category is Electronics, and it should be in stock. Include features like noise cancellation, 30-hour battery life, and water resistance. Add technical specifications including frequency response, driver size, and connectivity options.',
      schema: productSchema,
      enhancedOptions: {
        enableReliability: true,
        maxSteps: 4,
        minResponseLength: 30,
      },
    });

    console.log('✅ Streaming Product Object:');
    console.log('Streaming object parts...\n');
    
    let fullObject3 = '';
    for await (const chunk of productStreamResult.partialObjectStream) {
      process.stdout.write(JSON.stringify(chunk, null, 2) + '\n---\n');
      fullObject3 = JSON.stringify(chunk, null, 2);
    }
    
    console.log('\n📊 Product Stream Statistics:');
    console.log(`- Final object: ${fullObject3}`);
    console.log(`- Finish reason: ${productStreamResult.finishReason}`);
    
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
    const unreliableStreamResult = await streamObjectOllama({
      model: ollama('llama3.2'),
      prompt: 'Generate weather for New York: 22 degrees celsius, sunny, 45% humidity.',
      schema: weatherSchema,
      enhancedOptions: {
        enableReliability: false,
      },
    });

    console.log('Streaming object parts...\n');
    
    let fullObject4 = '';
    for await (const chunk of unreliableStreamResult.partialObjectStream) {
      process.stdout.write(JSON.stringify(chunk, null, 2) + '\n---\n');
      fullObject4 = JSON.stringify(chunk, null, 2);
    }
    
    console.log(`\n- Final object: ${fullObject4}`);
    console.log(`- Finish reason: ${unreliableStreamResult.finishReason}`);
    
  } catch (error) {
    console.log('❌ Error:', error instanceof Error ? error.message : String(error));
  }

  // With reliability
  console.log('\n🟢 With Reliability Features:');
  try {
    const reliableStreamResult = await streamObjectOllama({
      model: ollama('llama3.2'),
      prompt: 'Generate weather for New York: 22 degrees celsius, sunny, 45% humidity.',
      schema: weatherSchema,
      enhancedOptions: {
        enableReliability: true,
        maxSteps: 3,
        minResponseLength: 20,
      },
    });

    console.log('Streaming object parts...\n');
    
    let fullObject5 = '';
    for await (const chunk of reliableStreamResult.partialObjectStream) {
      process.stdout.write(JSON.stringify(chunk, null, 2) + '\n---\n');
      fullObject5 = JSON.stringify(chunk, null, 2);
    }
    
    console.log(`\n- Final object: ${fullObject5}`);
    console.log(`- Finish reason: ${reliableStreamResult.finishReason}`);
    
  } catch (error) {
    console.log('❌ Error:', error instanceof Error ? error.message : String(error));
  }

  // Test 5: Error Handling and Recovery
  console.log('\n' + '='.repeat(70));
  console.log('\n📌 Test 5: Error Handling and Recovery');
  console.log('Testing how the system handles malformed requests\n');

  try {
    const errorStreamResult = await streamObjectOllama({
      model: ollama('llama3.2'),
      prompt: 'Generate invalid data that should cause errors but be recovered.',
      schema: weatherSchema,
      enhancedOptions: {
        enableReliability: true,
        maxSteps: 3,
        minResponseLength: 10,
      },
    });

    console.log('✅ Error Recovery Stream:');
    console.log('Streaming object parts...\n');
    
    let fullObject6 = '';
    for await (const chunk of errorStreamResult.partialObjectStream) {
      process.stdout.write(JSON.stringify(chunk, null, 2) + '\n---\n');
      fullObject6 = JSON.stringify(chunk, null, 2);
    }
    
    console.log('\n📊 Error Recovery Statistics:');
    console.log(`- Final object: ${fullObject6}`);
    console.log(`- Finish reason: ${errorStreamResult.finishReason}`);
    
  } catch (error) {
    console.log('❌ Error:', error instanceof Error ? error.message : String(error));
  }

  console.log('\n' + '='.repeat(70));
  console.log('\n🎉 Stream Object Ollama Demo Complete!');
  console.log('The streamObjectOllama function provides enhanced reliability for object streaming with Ollama models.');
}

// Run the demo
demoStreamObjectOllama().catch(console.error);
