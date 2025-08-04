/**
 * Tool Calling Example with AI SDK and Ollama
 *
 * This example demonstrates how to use tool calling with the Ollama provider.
 * Ollama supports tool calling with models like Llama 3.1, Llama 3.2, and others.
 */

import { ollama } from '../src';
import { generateText } from 'ai';
import { z } from 'zod';

// Mock weather function
async function getWeather(location: string, unit: string = 'celsius') {
  // This is a mock function - in real use, this would call a weather API
  const temps = {
    'San Francisco': { celsius: 18, fahrenheit: 64 },
    'New York': { celsius: 22, fahrenheit: 72 },
    London: { celsius: 15, fahrenheit: 59 },
    Tokyo: { celsius: 26, fahrenheit: 79 },
  };

  const weather = temps[location] || { celsius: 20, fahrenheit: 68 };
  return {
    location,
    temperature: weather[unit],
    unit,
    condition: 'Partly cloudy',
    humidity: 65,
  };
}

// Mock flight status function
async function getFlightStatus(flightNumber: string) {
  return {
    flightNumber,
    status: 'On time',
    departure: '10:30 AM',
    arrival: '2:45 PM',
    gate: 'B42',
  };
}

async function demonstrateToolCalling() {
  console.log('🔧 Ollama Tool Calling Examples\n');
  console.log('='.repeat(50));

  // Example 1: Basic Tool Calling with Weather
  console.log('\n📌 Example 1: Weather Tool');
  console.log('Question: "What\'s the weather in San Francisco?"\n');

  try {
    const result = await generateText({
      model: ollama('llama3.2'),
      prompt:
        'What is the weather in San Francisco? Please use the weather tool.',
      tools: {
        get_weather: {
          description: 'Get the current weather for a location',
          parameters: z.object({
            location: z.string().describe('The city name'),
            unit: z
              .enum(['celsius', 'fahrenheit'])
              .optional()
              .describe('Temperature unit'),
          }),
          execute: async ({ location, unit }) => {
            return await getWeather(location, unit);
          },
        },
      },
    });

    console.log('Response:', result.text);
    if (result.toolCalls && result.toolCalls.length > 0) {
      console.log('\n✅ Tool was called!');
      console.log('Tool calls:', JSON.stringify(result.toolCalls, null, 2));

      // Execute tool calls
      for (const toolCall of result.toolCalls) {
        if (toolCall.toolName === 'get_weather') {
          const weather = await getWeather(
            toolCall.input.location,
            toolCall.input.unit,
          );
          console.log('Tool result:', weather);
        }
      }
    }
  } catch (error) {
    console.log(
      'Note: Tool calling requires a model that supports it (e.g., Llama 3.1)',
    );
    console.log('Error:', error.message);
  }

  // Example 2: Multiple Tools
  console.log('\n' + '='.repeat(50));
  console.log('\n📌 Example 2: Multiple Tools');
  console.log(
    'Question: "What\'s the weather in Tokyo and the status of flight AA123?"\n',
  );

  try {
    const result = await generateText({
      model: ollama('llama3.2'),
      prompt:
        'What is the weather in Tokyo and what is the status of flight AA123?',
      tools: {
        get_weather: {
          description: 'Get the current weather for a location',
          parameters: z.object({
            location: z.string().describe('The city name'),
            unit: z.enum(['celsius', 'fahrenheit']).optional(),
          }),
          execute: async ({ location, unit }) => {
            return await getWeather(location, unit);
          },
        },
        get_flight_status: {
          description: 'Get the status of a flight',
          parameters: z.object({
            flightNumber: z.string().describe('The flight number'),
          }),
          execute: async ({ flightNumber }) => {
            return await getFlightStatus(flightNumber);
          },
        },
      },
      toolChoice: 'auto', // Let the model decide which tools to use
    });

    console.log('Response:', result.text);
    if (result.toolCalls && result.toolCalls.length > 0) {
      console.log('\n✅ Tools were called!');
      console.log('Number of tool calls:', result.toolCalls.length);

      for (const toolCall of result.toolCalls) {
        console.log(`\nTool: ${toolCall.toolName}`);
        console.log('Arguments:', toolCall.input);

        let toolResult;
        if (toolCall.toolName === 'get_weather') {
          toolResult = await getWeather(
            toolCall.input.location,
            toolCall.input.unit,
          );
        } else if (toolCall.toolName === 'get_flight_status') {
          toolResult = await getFlightStatus(toolCall.input.flightNumber);
        }
        console.log('Result:', toolResult);
      }
    }
  } catch (error) {
    console.log('Error:', error.message);
  }

  // Example 3: Tool Choice Options
  console.log('\n' + '='.repeat(50));
  console.log('\n📌 Example 3: Tool Choice Control');

  // Force specific tool
  console.log('\nForcing weather tool usage:\n');
  try {
    const result = await generateText({
      model: ollama('llama3.2'),
      prompt: 'Tell me about Paris',
      tools: {
        get_weather: {
          description: 'Get the current weather for a location',
          parameters: z.object({
            location: z.string(),
          }),
          execute: async ({ location }) => {
            return await getWeather(location);
          },
        },
      },
      toolChoice: 'required', // Force the model to use a tool
    });

    console.log('Response:', result.text);
    if (result.toolCalls && result.toolCalls.length > 0) {
      console.log('Tool was called for:', result.toolCalls[0].input.location);
    }
  } catch (error) {
    console.log('Error:', error.message);
  }

  console.log('\n' + '='.repeat(50));
  console.log('\n📚 Summary:');
  console.log('- Ollama supports tool calling with compatible models');
  console.log(
    '- Models like Llama 3.1, Llama 3.2, Mistral, and others support tools',
  );
  console.log('- Tools can be defined with schemas and execute functions');
  console.log('- Tool choice can be controlled (auto, required, none)');
  console.log(
    '\n⚠️ Note: Tool calling requires models that support this feature.',
  );
  console.log(
    'If you get errors, ensure you have a compatible model installed.',
  );
}

// Run the demonstration
demonstrateToolCalling().catch(console.error);
