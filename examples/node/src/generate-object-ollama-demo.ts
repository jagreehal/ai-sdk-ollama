/**
 * Generate Object Ollama Demo
 * 
 * This example demonstrates the generateObjectOllama function which provides
 * enhanced object generation with reliability features for Ollama models.
 * 
 * The function wraps the AI SDK's generateObject with additional reliability
 * features including retry logic, parameter normalization, and better error handling.
 */

import { ollama } from 'ai-sdk-ollama';
import { generateObjectOllama } from 'ai-sdk-ollama';
import { z } from 'zod';

// Define schemas for different types of objects
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

const productSchema = z.object({
  name: z.string().describe('Product name'),
  price: z.number().describe('Price in USD'),
  category: z.string().describe('Product category'),
  description: z.string().describe('Product description'),
  features: z.array(z.string()).describe('Key product features'),
  inStock: z.boolean().describe('Whether the product is in stock'),
});

async function demoGenerateObjectOllama() {
  console.log('🎯 Generate Object Ollama Demo\n');
  console.log('This demo shows how to use generateObjectOllama for reliable object generation.\n');
  console.log('='.repeat(70));

  // Test 1: Basic Object Generation
  console.log('\n📌 Test 1: Basic Weather Object Generation');
  console.log('Generating a weather object with reliability features\n');

  try {
    const weatherResult = await generateObjectOllama({
      model: ollama('llama3.2'),
      prompt: 'Generate weather information for San Francisco. It should be 18 degrees celsius, partly cloudy, with 65% humidity.',
      schema: weatherSchema,
      enhancedOptions: {
        enableReliability: true,
        maxSteps: 3,
        minResponseLength: 10,
        objectReliabilityOptions: {
          maxRetries: 2,
          attemptRecovery: true,
          useFallbacks: true,
        },
      },
    });

    console.log('✅ Weather Object Generated:');
    console.log(`- Location: ${weatherResult.object.location}`);
    console.log(`- Temperature: ${weatherResult.object.temperature}°${weatherResult.object.unit}`);
    console.log(`- Condition: ${weatherResult.object.condition}`);
    console.log(`- Humidity: ${weatherResult.object.humidity}%`);
    console.log(`- Reliability: Success=${weatherResult.success}, Retries=${weatherResult.retryCount}`);
    console.log(`- Finish Reason: ${weatherResult.finishReason}`);
    
  } catch (error) {
    console.log('❌ Error:', error instanceof Error ? error.message : String(error));
  }

  // Test 2: Complex Object Generation
  console.log('\n' + '='.repeat(70));
  console.log('\n📌 Test 2: Complex Person Object Generation');
  console.log('Generating a detailed person object\n');

  try {
    const personResult = await generateObjectOllama({
      model: ollama('llama3.2'),
      prompt: 'Create a profile for a software engineer named Alex Johnson, age 28, living in Seattle, Washington. They are interested in machine learning, hiking, and photography.',
      schema: personSchema,
      enhancedOptions: {
        enableReliability: true,
        maxSteps: 5,
        objectReliabilityOptions: {
          maxRetries: 3,
          attemptRecovery: true,
          fixTypeMismatches: true,
        },
      },
    });

    console.log('✅ Person Object Generated:');
    console.log(`- Name: ${personResult.object.name}`);
    console.log(`- Age: ${personResult.object.age}`);
    console.log(`- Occupation: ${personResult.object.occupation}`);
    console.log(`- Location: ${personResult.object.location}`);
    console.log(`- Interests: ${personResult.object.interests.join(', ')}`);
    console.log(`- Reliability: Success=${personResult.success}, Retries=${personResult.retryCount}`);
    
  } catch (error) {
    console.log('❌ Error:', error instanceof Error ? error.message : String(error));
  }

  // Test 3: Product Object with Array Fields
  console.log('\n' + '='.repeat(70));
  console.log('\n📌 Test 3: Product Object with Complex Fields');
  console.log('Generating a product object with arrays and boolean fields\n');

  try {
    const productResult = await generateObjectOllama({
      model: ollama('llama3.2'),
      prompt: 'Create a product object for a wireless Bluetooth headphones. Price should be $199.99, category is Electronics, and it should be in stock. Include features like noise cancellation, 30-hour battery life, and water resistance.',
      schema: productSchema,
      enhancedOptions: {
        enableReliability: true,
        maxSteps: 4,
        objectReliabilityOptions: {
          maxRetries: 2,
          attemptRecovery: true,
          useFallbacks: true,
          fixTypeMismatches: true,
        },
      },
    });

    console.log('✅ Product Object Generated:');
    console.log(`- Name: ${productResult.object.name}`);
    console.log(`- Price: $${productResult.object.price}`);
    console.log(`- Category: ${productResult.object.category}`);
    console.log(`- Description: ${productResult.object.description}`);
    console.log(`- Features: ${productResult.object.features.join(', ')}`);
    console.log(`- In Stock: ${productResult.object.inStock ? 'Yes' : 'No'}`);
    console.log(`- Reliability: Success=${productResult.success}, Retries=${productResult.retryCount}`);
    
  } catch (error) {
    console.log('❌ Error:', error instanceof Error ? error.message : String(error));
  }

  // Test 4: Reliability Comparison
  console.log('\n' + '='.repeat(70));
  console.log('\n📌 Test 4: Reliability Comparison');
  console.log('Comparing with and without reliability features\n');

  // Without reliability
  console.log('\n🔴 Without Reliability Features:');
  try {
    const unreliableResult = await generateObjectOllama({
      model: ollama('llama3.2'),
      prompt: 'Generate weather for New York: 22 degrees celsius, sunny, 45% humidity.',
      schema: weatherSchema,
      enhancedOptions: {
        enableReliability: false,
      },
    });

    console.log(`- Success: ${unreliableResult.success}`);
    console.log(`- Retries: ${unreliableResult.retryCount}`);
    console.log(`- Object: ${JSON.stringify(unreliableResult.object, null, 2)}`);
    
  } catch (error) {
    console.log('❌ Error:', error instanceof Error ? error.message : String(error));
  }

  // With reliability
  console.log('\n🟢 With Reliability Features:');
  try {
    const reliableResult = await generateObjectOllama({
      model: ollama('llama3.2'),
      prompt: 'Generate weather for New York: 22 degrees celsius, sunny, 45% humidity.',
      schema: weatherSchema,
      enhancedOptions: {
        enableReliability: true,
        objectReliabilityOptions: {
          maxRetries: 3,
          attemptRecovery: true,
          useFallbacks: true,
        },
      },
    });

    console.log(`- Success: ${reliableResult.success}`);
    console.log(`- Retries: ${reliableResult.retryCount}`);
    console.log(`- Object: ${JSON.stringify(reliableResult.object, null, 2)}`);
    
  } catch (error) {
    console.log('❌ Error:', error instanceof Error ? error.message : String(error));
  }

  // Test 5: Error Handling and Recovery
  console.log('\n' + '='.repeat(70));
  console.log('\n📌 Test 5: Error Handling and Recovery');
  console.log('Testing how the system handles malformed requests\n');

  try {
    const errorResult = await generateObjectOllama({
      model: ollama('llama3.2'),
      prompt: 'Generate invalid data that should cause errors but be recovered.',
      schema: weatherSchema,
      enhancedOptions: {
        enableReliability: true,
        objectReliabilityOptions: {
          maxRetries: 3,
          attemptRecovery: true,
          useFallbacks: true,
          fixTypeMismatches: true,
        },
      },
    });

    console.log('✅ Error Recovery Result:');
    console.log(`- Success: ${errorResult.success}`);
    console.log(`- Retries: ${errorResult.retryCount}`);
    console.log(`- Recovery Method: ${errorResult.recoveryMethod || 'N/A'}`);
    console.log(`- Errors: ${errorResult.errors?.join(', ') || 'None'}`);
    console.log(`- Object: ${JSON.stringify(errorResult.object, null, 2)}`);
    
  } catch (error) {
    console.log('❌ Error:', error instanceof Error ? error.message : String(error));
  }

  console.log('\n' + '='.repeat(70));
  console.log('\n🎉 Generate Object Ollama Demo Complete!');
  console.log('The generateObjectOllama function provides enhanced reliability for object generation with Ollama models.');
}

// Run the demo
demoGenerateObjectOllama().catch(console.error);
