/**
 * AI SDK v6 - Structured Output with Tools Example
 *
 * AI SDK v6 stabilizes structured output support, enabling you to
 * generate structured data alongside multi-step tool calling.
 *
 * Note: Local LLMs may have varying success with complex structured outputs.
 * This example includes error handling to demonstrate the feature gracefully.
 */

import { generateText, streamText, Output, tool, stepCountIs } from 'ai';
import { z } from 'zod';
import { GRANITE_4_MODEL as model } from './model';

// Weather tool
const weatherTool = tool({
  description: 'Get the current weather for a location',
  inputSchema: z.object({
    city: z.string().describe('City to get weather for'),
  }),
  execute: async ({ city }) => {
    console.log(`  [Tool] Fetching weather for ${city}...`);
    // Simulated weather data
    const temps: Record<string, number> = {
      'San Francisco': 65,
      'New York': 45,
      'Miami': 82,
      'Seattle': 52,
    };
    return {
      city,
      temperature: temps[city] || Math.floor(Math.random() * 30) + 50,
      condition: ['sunny', 'cloudy', 'rainy'][Math.floor(Math.random() * 3)],
    };
  },
});

async function main() {
  console.log('AI SDK v6 - Structured Output with Tools');
  console.log('=========================================\n');

  // Example 1: Simple structured output (no tools)
  console.log('Example 1: Basic structured output');
  console.log('----------------------------------');

  try {
    const simpleOutput = await generateText({
      model,
      maxOutputTokens: 512,
      output: Output.object({
        schema: z.object({
          greeting: z.string(),
          mood: z.string(),
        }),
      }),
      prompt: 'Say hello and describe your mood as a helpful assistant.',
    });

    console.log('Text:', simpleOutput.text);
    console.log('Structured Output:', simpleOutput.output);
  } catch (error) {
    console.log('Error (expected with some LLMs):', (error as Error).message.slice(0, 100));
  }
  console.log();

  // Example 2: Structured output with tools
  console.log('Example 2: Weather report with structured output');
  console.log('------------------------------------------------');
  console.log('Note: Combines tool calling with structured output generation.\n');

  try {
    const weatherReport = await generateText({
      model,
      maxOutputTokens: 1024,
      tools: { weather: weatherTool },
      stopWhen: stepCountIs(3),
      output: Output.object({
        schema: z.object({
          city: z.string().describe('City name'),
          temperature: z.number().describe('Temperature in Fahrenheit'),
          summary: z.string().describe('Brief weather summary'),
        }),
      }),
      prompt: 'What is the weather in San Francisco? Return a structured report.',
    });

    console.log('Text:', weatherReport.text);
    console.log('Structured Output:', weatherReport.output);
    console.log('Tool Calls:', weatherReport.toolCalls.length);
    console.log('Steps:', weatherReport.steps.length);
  } catch (error) {
    console.log('Error:', (error as Error).message.slice(0, 150));
    console.log('\nThis is expected - local LLMs may struggle with complex');
    console.log('structured output + tool calling. Cloud models handle this better.');
  }
  console.log();

  // Example 3: Output.array for multiple items
  console.log('Example 3: Output.array for multiple items');
  console.log('------------------------------------------');

  try {
    const cities = await generateText({
      model,
      maxOutputTokens: 512,
      output: Output.array({
        element: z.object({
          name: z.string(),
          country: z.string(),
        }),
      }),
      prompt: 'List 3 major cities in Europe with their countries.',
    });

    console.log('Text:', cities.text?.slice(0, 100) + '...');
    console.log('Array Output:', cities.output);
  } catch (error) {
    console.log('Error:', (error as Error).message.slice(0, 100));
  }
  console.log();

  // Example 4: Output.choice for selecting from options
  console.log('Example 4: Output.choice (select from options)');
  console.log('--------------------------------------------');

  try {
    const weatherChoice = await generateText({
      model,
      maxOutputTokens: 128,
      output: Output.choice({
        options: ['sunny', 'cloudy', 'rainy', 'snowy', 'windy'],
      }),
      prompt: 'Based on the current conditions, is the weather sunny, cloudy, rainy, snowy, or windy?',
    });

    console.log('Text:', weatherChoice.text);
    console.log('Choice Output:', weatherChoice.output);
    console.log('(Must be one of: sunny, cloudy, rainy, snowy, windy)');
  } catch (error) {
    console.log('Error:', (error as Error).message.slice(0, 100));
  }
  console.log();

  // Example 5: Streaming structured output with streamText
  console.log('Example 5: Streaming structured output');
  console.log('--------------------------------------');
  console.log('Note: Shows partial objects as they are generated.\n');

  try {
    const streamResult = await streamText({
      model,
      maxOutputTokens: 512,
      output: Output.object({
        schema: z.object({
          name: z.string(),
          age: z.number().nullable().describe('Age of the person'),
          occupation: z.string(),
          hobbies: z.array(z.string()),
        }),
      }),
      prompt: 'Generate a realistic person profile with name, age, occupation, and hobbies.',
    });

    console.log('Streaming partial structured output:');
    let partialCount = 0;
    for await (const partial of streamResult.partialOutputStream) {
      partialCount++;
      console.log(`  Partial ${partialCount}:`, JSON.stringify(partial, null, 2));
    }

    // Get final result
    const finalOutput = await streamResult.output;
    const finalText = await streamResult.text;
    console.log('\nFinal Output:', finalOutput);
    console.log('Final Text:', finalText?.slice(0, 100) + '...');
  } catch (error) {
    console.log('Error:', (error as Error).message.slice(0, 150));
    console.log('\nNote: Streaming structured output may not work with all local LLMs.');
  }
  console.log();

  // Example 6: Output.text (explicit)
  console.log('Example 6: Output.text (explicit)');
  console.log('----------------------------------');
  console.log('Note: Output.text() is the default, but can be explicitly specified.\n');

  try {
    const textOutput = await generateText({
      model,
      maxOutputTokens: 256,
      output: Output.text(),
      prompt: 'Write a short haiku about programming.',
    });

    console.log('Text Output:', textOutput.text);
    console.log('(No structured output - just plain text)');
  } catch (error) {
    console.log('Error:', (error as Error).message.slice(0, 100));
  }
  console.log();

  // Summary of Output types
  console.log('Available Output Types in AI SDK v6:');
  console.log('------------------------------------');
  console.log('- Output.text()   : Plain text (default)');
  console.log('- Output.object() : Structured object with Zod schema');
  console.log('- Output.array()  : Array of structured objects');
  console.log('- Output.choice() : Select from predefined options');
  console.log();

  console.log('Structured output examples completed!');
  console.log('\nTip: For best results with structured output + tools,');
  console.log('use capable models like GPT-4, Claude, or larger Ollama models.');
}

main().catch(console.error);
