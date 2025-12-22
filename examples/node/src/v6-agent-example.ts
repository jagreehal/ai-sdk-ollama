/**
 * AI SDK v6 - ToolLoopAgent Example
 *
 * This example demonstrates the new Agent abstraction in AI SDK v6.
 * ToolLoopAgent provides a default implementation that automatically:
 * 1. Calls the LLM with your prompt
 * 2. Executes any requested tool calls
 * 3. Adds results back to the conversation
 * 4. Repeats until complete
 */

import { ToolLoopAgent, tool, stepCountIs, Output } from 'ai';
import { z } from 'zod';
import { GRANITE_4_MODEL as model } from './model';

// Define a weather tool
const weatherTool = tool({
  description: 'Get the current weather for a location',
  inputSchema: z.object({
    city: z.string().describe('The city to get weather for'),
  }),
  execute: async ({ city }) => {
    // Simulated weather data
    const conditions = ['sunny', 'cloudy', 'rainy', 'windy'];
    const condition = conditions[Math.floor(Math.random() * conditions.length)];
    const temperature = Math.floor(Math.random() * 30) + 50; // 50-80°F

    console.log(`  [Tool] Getting weather for ${city}...`);
    return {
      city,
      temperature,
      condition,
      humidity: Math.floor(Math.random() * 50) + 30,
    };
  },
});

// Define a calculator tool
const calculatorTool = tool({
  description: 'Perform basic arithmetic calculations',
  inputSchema: z.object({
    operation: z
      .enum(['add', 'subtract', 'multiply', 'divide'])
      .describe('The operation to perform'),
    a: z.number().describe('First number'),
    b: z.number().describe('Second number'),
  }),
  execute: async ({ operation, a, b }) => {
    console.log(`  [Tool] Calculating ${a} ${operation} ${b}...`);
    switch (operation) {
      case 'add':
        return { result: a + b };
      case 'subtract':
        return { result: a - b };
      case 'multiply':
        return { result: a * b };
      case 'divide':
        return { result: b !== 0 ? a / b : 'Error: Division by zero' };
    }
  },
});

// Create a ToolLoopAgent with multiple tools
const agent = new ToolLoopAgent({
  model,
  instructions:
    'You are a helpful assistant that can check weather and do calculations. Be concise.',
  tools: {
    weather: weatherTool,
    calculator: calculatorTool,
  },
  // Stop after 5 steps max (default is 20)
  stopWhen: stepCountIs(5),
});

// Create an agent with call options for dynamic configuration
const supportAgent = new ToolLoopAgent({
  model,
  callOptionsSchema: z.object({
    userId: z.string(),
    accountType: z.enum(['free', 'pro', 'enterprise']),
  }),
  instructions: 'You are a helpful customer support agent.',
  tools: {
    calculator: calculatorTool,
  },
  prepareCall: ({ options, ...settings }) => ({
    ...settings,
    instructions:
      settings.instructions +
      `\nUser context:\n- Account type: ${options.accountType}\n- User ID: ${options.userId}\n\nAdjust your response based on the user's account level.`,
  }),
});

// Create an agent with structured output
const weatherReportAgent = new ToolLoopAgent({
  model,
  instructions: 'You are a weather assistant that provides structured reports.',
  tools: {
    weather: weatherTool,
  },
  output: Output.object({
    schema: z.object({
      city: z.string().describe('City name'),
      temperature: z.number().describe('Temperature in Fahrenheit'),
      condition: z.string().describe('Weather condition'),
      recommendation: z.string().describe('What to wear or do'),
    }),
  }),
  stopWhen: stepCountIs(3),
});

async function main() {
  console.log('AI SDK v6 - ToolLoopAgent Example');
  console.log('==================================\n');

  // Example 1: Simple tool usage
  console.log('Example 1: Weather query');
  console.log('-------------------------');
  const weatherResult = await agent.generate({
    prompt: 'What is the weather in San Francisco?',
  });
  console.log('Response:', weatherResult.text);
  console.log('Steps taken:', weatherResult.steps.length);
  console.log();

  // Example 2: Multi-tool usage
  console.log('Example 2: Multi-tool query');
  console.log('----------------------------');
  const multiResult = await agent.generate({
    prompt:
      'What is the weather in New York and what is 25 multiplied by 4?',
  });
  console.log('Response:', multiResult.text);
  console.log('Steps taken:', multiResult.steps.length);
  console.log();

  // Example 3: Streaming with agent
  console.log('Example 3: Streaming response');
  console.log('-----------------------------');
  const streamResult = await agent.stream({
    prompt: 'Calculate 100 divided by 5 and tell me the result.',
  });

  process.stdout.write('Streaming: ');
  for await (const chunk of streamResult.textStream) {
    process.stdout.write(chunk);
  }
  console.log('\n');

  // Example 4: Call options for dynamic configuration
  console.log('Example 4: Call options (dynamic configuration)');
  console.log('------------------------------------------------');
  const supportResult = await supportAgent.generate({
    prompt: 'How do I upgrade my account?',
    options: {
      userId: 'user_123',
      accountType: 'free',
    },
  });
  console.log('Response:', supportResult.text);
  console.log('Steps taken:', supportResult.steps.length);
  console.log();

  // Example 5: Structured output with ToolLoopAgent
  console.log('Example 5: Structured output with ToolLoopAgent');
  console.log('------------------------------------------------');
  try {
    const reportResult = await weatherReportAgent.generate({
      prompt: 'What is the weather in San Francisco? Provide a structured report.',
    });
    console.log('Text:', reportResult.text);
    console.log('Structured Output:', reportResult.output);
    console.log('Tool Calls:', reportResult.toolCalls.length);
    console.log('Steps:', reportResult.steps.length);
  } catch (error) {
    console.log('Error:', (error as Error).message.slice(0, 150));
    console.log('\nNote: Some local LLMs may struggle with structured output + tools.');
  }
  console.log();

  // Example 6: Streaming structured output
  console.log('Example 6: Streaming structured output');
  console.log('--------------------------------------');
  try {
    const streamReport = await weatherReportAgent.stream({
      prompt: 'What is the weather in Miami? Provide a structured report.',
    });

    console.log('Streaming partial structured output:');
    for await (const partial of streamReport.partialOutputStream) {
      console.log('  Partial:', JSON.stringify(partial, null, 2));
    }
    const finalOutput = await streamReport.output;
    console.log('Final Output:', finalOutput);
  } catch (error) {
    console.log('Error:', (error as Error).message.slice(0, 150));
  }
  console.log();

  console.log('Agent examples completed!');
}

main().catch(console.error);
