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
          inputSchema: z.object({
            location: z.string().describe('The city name (required)'),
            unit: z
              .enum(['celsius', 'fahrenheit'])
              .optional()
              .describe('Temperature unit (optional, defaults to celsius)'),
          }),
          execute: async (params) => {
            // Handle different parameter names that Ollama might return
            const location =
              params.location || params.city || params.q || params.place;
            const unit = params.unit || params.temperature_unit || 'celsius';
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
        if (toolCall && toolCall.toolName === 'get_weather') {
          // Parse the input if it's a JSON string
          let parsedInput;
          try {
            parsedInput =
              typeof toolCall.input === 'string'
                ? JSON.parse(toolCall.input)
                : toolCall.input;
          } catch (parseError) {
            const errorMessage =
              parseError instanceof Error
                ? parseError.message
                : String(parseError);
            console.log('Could not parse tool input:', errorMessage);
            continue;
          }

          // Note: Due to Zod version compatibility issues, schema conversion may fail
          // When this happens, Ollama receives an empty schema and invents its own parameter names
          // This is why we need to handle multiple possible parameter names
          const location =
            parsedInput.location || parsedInput.city || parsedInput.q;
          const unit = parsedInput.unit || parsedInput.temperature_unit;
          const weather = await getWeather(location, unit);
          console.log('Tool result:', weather);
        }
      }
    }
  } catch (error) {
    console.log(
      'Note: Tool calling requires a model that supports it (e.g., Llama 3.1)',
    );
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.log('Error:', errorMessage);
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
          inputSchema: z.object({
            location: z.string().describe('The city name'),
            unit: z.enum(['celsius', 'fahrenheit']).optional(),
          }),
          execute: async (params) => {
            // Handle different parameter names that Ollama might return
            const location =
              params.location || params.city || params.q || params.place;
            const unit = params.unit || params.temperature_unit || 'celsius';
            return await getWeather(location, unit);
          },
        },
        get_flight_status: {
          description: 'Get the status of a flight',
          inputSchema: z.object({
            flightNumber: z.string().describe('The flight number (required)'),
          }),
          execute: async (params) => {
            // Handle different parameter names that Ollama might return
            const flightNumber =
              params.flightNumber || params.flight_number || params.flight;
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
        if (!toolCall) continue;

        console.log(`\nTool: ${toolCall.toolName}`);
        console.log('Raw input:', toolCall.input);

        // Parse the input if it's a JSON string
        let parsedInput;
        try {
          parsedInput =
            typeof toolCall.input === 'string'
              ? JSON.parse(toolCall.input)
              : toolCall.input;
          console.log('Parsed input:', parsedInput);
        } catch (parseError) {
          const errorMessage =
            parseError instanceof Error
              ? parseError.message
              : String(parseError);
          console.log('Could not parse tool input:', errorMessage);
          continue;
        }

        let toolResult;
        if (toolCall.toolName === 'get_weather') {
          // Note: Ollama may return different parameter names than defined in schema
          const location =
            parsedInput.location || parsedInput.city || parsedInput.q;
          const unit = parsedInput.unit || parsedInput.temperature_unit;
          toolResult = await getWeather(location, unit);
        } else if (toolCall.toolName === 'get_flight_status') {
          // Note: Ollama may return different parameter names than defined in schema
          const flightNumber =
            parsedInput.flightNumber ||
            parsedInput.flight_number ||
            parsedInput.flight;
          toolResult = await getFlightStatus(flightNumber);
        }
        console.log('Result:', toolResult);
      }
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.log('Error:', errorMessage);
  }

  // Example 3: Tool Choice Options
  console.log('\n' + '='.repeat(50));
  console.log('\n📌 Example 3: Tool Choice Control');

  // Force specific tool
  console.log('\nForcing weather tool usage:\n');
  try {
    const result = await generateText({
      model: ollama('llama3.2'),
      prompt: 'Get the weather for Paris using the weather tool',
      tools: {
        get_weather: {
          description: 'Get the current weather for a location',
          inputSchema: z.object({
            location: z.string(),
          }),
          execute: async (params) => {
            // Handle different parameter names that Ollama might return
            const location =
              params.location || params.city || params.q || params.place;
            return await getWeather(location);
          },
        },
      },
      toolChoice: 'required', // Force the model to use a tool
    });

    console.log('Response:', result.text);
    if (result.toolCalls && result.toolCalls.length > 0) {
      const toolCall = result.toolCalls[0];
      if (toolCall) {
        console.log('Tool was called:', toolCall.toolName);
        console.log('Raw input:', toolCall.input);

        // Parse the input if it's a JSON string
        let parsedInput;
        try {
          parsedInput =
            typeof toolCall.input === 'string'
              ? JSON.parse(toolCall.input)
              : toolCall.input;
          console.log('Parsed input:', parsedInput);
          // Note: Ollama may return different parameter names than defined in schema
          const location =
            parsedInput.location || parsedInput.city || parsedInput.q;
          console.log('Location:', location);
        } catch (parseError) {
          const errorMessage =
            parseError instanceof Error
              ? parseError.message
              : String(parseError);
          console.log('Could not parse tool input:', errorMessage);
        }
      }
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.log('Error:', errorMessage);
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
