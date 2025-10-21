/**
 * 🚀 AI-SDK-OLLAMA: Streaming Tool Calling Comparison
 *
 * GOOD NEWS: ai-sdk-ollama now works with standard AI SDK streamText!
 * - Tools execute properly ✅
 * - Multi-turn conversations work ✅
 * - Text streams correctly ✅
 *
 * EVEN BETTER: ai-sdk-ollama's enhanced streamText provides synthesis for more reliable streaming
 * - Some Ollama models occasionally stream no text after tool execution
 * - The enhanced version adds intelligent synthesis to guarantee streaming responses
 * - This comparison shows both approaches working
 */

import { ollama, streamText as streamTextOllama } from 'ai-sdk-ollama';
import { streamText, tool, stepCountIs, type ToolSet } from 'ai';
import { z } from 'zod';
import { styleText } from 'util';

// Test tools for streaming demo
const weatherTool = tool({
  description: 'Get current weather information',
  inputSchema: z.object({
    location: z.string().describe('City name'),
    unit: z.enum(['celsius', 'fahrenheit']).optional().describe('Temperature unit'),
  }),
  execute: async ({ location, unit = 'celsius' }) => {
    console.log(`    🌤️ Weather tool executed for: ${location} (${unit})`);
    await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate API call
    return {
      location,
      temperature: Math.floor(Math.random() * 15) + 15, // 15-30°C
      unit,
      condition: 'partly cloudy',
      humidity: 65,
      windSpeed: 12,
    };
  },
});

const calculatorTool = tool({
  description: 'Perform mathematical calculations',
  inputSchema: z.object({
    expression: z.string().describe('Math expression like "25 * 1.08"'),
  }),
  execute: async ({ expression }) => {
    console.log(`    🧮 Calculator tool executed: ${expression}`);
    await new Promise(resolve => setTimeout(resolve, 800)); // Simulate processing
    try {
      const result = eval(expression);
      return { expression, result, calculated: true };
    } catch (error) {
      return { expression, result: 'Error', calculated: false, error: String(error) };
    }
  },
});

const stockTool = tool({
  description: 'Get stock price information',
  inputSchema: z.object({
    symbol: z.string().describe('Stock symbol like AAPL, MSFT'),
  }),
  execute: async ({ symbol }) => {
    console.log(`    📈 Stock tool executed for: ${symbol}`);
    await new Promise(resolve => setTimeout(resolve, 1200)); // Simulate API call
    return {
      symbol: symbol.toUpperCase(),
      price: (Math.random() * 200 + 100).toFixed(2), // Random price $100-300
      change: (Math.random() * 10 - 5).toFixed(2), // Random change -$5 to +$5
      currency: 'USD',
      timestamp: new Date().toISOString(),
    };
  },
});

// Perfect streaming demo scenarios
const streamScenarios = [
  {
    name: '🌍 Weather Streaming',
    prompt: 'What\'s the weather like in San Francisco? Use the weather tool and give me a detailed summary.',
    tools: { weather: weatherTool },
    social_impact: 'Real-time weather updates - users expect instant streaming',
  },
  {
    name: '💰 Financial Streaming',
    prompt: 'Calculate my investment return: 5000 * 1.07. Use the calculator and explain the result.',
    tools: { calculator: calculatorTool },
    social_impact: 'Financial calculations - precision and speed matter',
  },
  {
    name: '📊 Stock Analysis Streaming',
    prompt: 'Get the current AAPL stock price and analyze if it\'s a good buy.',
    tools: { stock: stockTool },
    social_impact: 'Trading decisions - delayed responses cost money',
  },
] as const;

interface StreamResult {
  success: boolean;
  toolCalls: number;
  toolResults: number;
  streamedChars: number;
  finalText: string;
  error: string | null;
}

function logStreamResult(provider: string, success: boolean, details: StreamResult) {
  const status = success ? '✅' : '❌';
  const color = success ? 'green' : 'red';

  console.log(`  ${status} ${styleText([color], provider)}:`);
  console.log(`    • Tool calls: ${details.toolCalls || 0}`);
  console.log(`    • Tool results: ${details.toolResults || 0}`);
  console.log(`    • Streamed: ${details.streamedChars || 0} characters`);

  if (details.finalText && details.finalText.length > 0) {
    console.log(`    • Final response: "${styleText(['green'], details.finalText.substring(0, 120))}${details.finalText.length > 120 ? '...' : ''}"`);
  } else {
    console.log(`    • Final response: ${styleText(['red'], 'NO TEXT STREAMED - Tools ran but silent!')}`);
  }

  if (details.error) {
    console.log(`    • Error: ${details.error}`);
  }

  console.log(''); 
}

async function testStandardStreamText(scenario: typeof streamScenarios[number]): Promise<StreamResult> {
  try {
    console.log(`\n  📡 Testing with standard streamText...`);

    const result = await streamText({
      model: ollama('llama3.2'),
      prompt: scenario.prompt,
      tools: scenario.tools,
      stopWhen: stepCountIs(5), // Enable multi-turn tool calling
    });

    let streamedText = '';
    let streamedChars = 0;

    console.log(`    🔄 Streaming response:`);
    for await (const chunk of result.textStream) {
      streamedText += chunk;
      streamedChars += chunk.length;
      process.stdout.write(styleText(['dim'], chunk));
    }
    console.log(''); // New line after streaming

    // Get final result for tool info
    const finalResult = await result;

    // Check if tools were called in ANY step (not just the last one)
    const allSteps = await finalResult.steps;
    const toolsWereCalled = allSteps?.some(step =>
      step.toolCalls && step.toolCalls.length > 0
    ) ?? false;

    // Count total tool calls across all steps
    const toolCalls = allSteps?.reduce((sum, step) =>
      sum + (step.toolCalls?.length || 0), 0
    ) || 0;

    const toolResults = allSteps?.reduce((sum, step) =>
      sum + (step.toolResults?.length || 0), 0
    ) || 0;

    const success = toolsWereCalled && streamedText.length > 0;

    return {
      success: Boolean(success),
      toolCalls,
      toolResults,
      streamedChars,
      finalText: streamedText,
      error: null,
    };
  } catch (error) {
    return {
      success: false,
      toolCalls: 0,
      toolResults: 0,
      streamedChars: 0,
      finalText: '',
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function testStreamTextOllama(scenario: typeof streamScenarios[number]): Promise<StreamResult> {
  try {
    console.log(`\n  🚀 Testing with ai-sdk-ollama's streamText (enhanced)...`);

    const result = await streamTextOllama({
      model: ollama('llama3.2'),
      prompt: scenario.prompt,
      tools: scenario.tools as Parameters<typeof streamTextOllama>[0]['tools'],
    });

    let streamedText = '';
    let streamedChars = 0;

    console.log(`    🔄 Streaming enhanced response:`);
    for await (const chunk of result.textStream) {
      streamedText += chunk;
      streamedChars += chunk.length;
      process.stdout.write(styleText(['green'], chunk));
    }
    console.log(''); // New line after streaming

    // Get final result for tool info
    const finalResult = await result;

    // Check if tools were called in ANY step (not just the last one)
    const allSteps = await finalResult.steps;
    const toolsWereCalled =
      allSteps?.some((step) => step.toolCalls && step.toolCalls.length > 0) ??
      false;

    // Count total tool calls across all steps
    const toolCalls =
      allSteps?.reduce((sum, step) => sum + (step.toolCalls?.length || 0), 0) ||
      0;

    const toolResults =
      allSteps?.reduce(
        (sum, step) => sum + (step.toolResults?.length || 0),
        0,
      ) || 0;

    const success = toolsWereCalled && streamedText.length > 0;

    return {
      success: Boolean(success),
      toolCalls,
      toolResults,
      streamedChars,
      finalText: streamedText,
      error: null,
    };
  } catch (error) {
    return {
      success: false,
      toolCalls: 0,
      toolResults: 0,
      streamedChars: 0,
      finalText: '',
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function runStreamingComparison() {
  console.log('\n' + '='.repeat(70));
  console.log(styleText(['bold', 'magenta'], '🚀 AI SDK Ollama: Streaming Tool Calling Comparison'));
  console.log(styleText('dim', 'Standard AI SDK vs Enhanced with Synthesis'));
  console.log('='.repeat(70) + '\n');

  let standardSuccessCount = 0;
  let enhancedSuccessCount = 0;

  for (const scenario of streamScenarios) {
    console.log('\n' + '─'.repeat(60));
    console.log(styleText(['bold', 'cyan'], `${scenario.name}`));
    console.log(styleText('dim', `Real-world impact: ${scenario.social_impact}`));
    console.log('─'.repeat(60));

    console.log(styleText(['bold', 'blue'], '\n📡 Standard streamText:'));
    const standardResult = await testStandardStreamText(scenario);
    logStreamResult('Standard streamText', standardResult.success, standardResult);

    if (standardResult.success) standardSuccessCount++;

    console.log(styleText(['bold', 'green'], '🚀 Enhanced ai-sdk-ollama streamText:'));
    const enhancedResult = await testStreamTextOllama(scenario);
    logStreamResult('ai-sdk-ollama streamText', enhancedResult.success, enhancedResult);

    if (enhancedResult.success) enhancedSuccessCount++;

    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  // Results summary
  console.log('\n' + '='.repeat(70));
  console.log(styleText(['bold', 'yellow'], '📊 Streaming Results Summary'));
  console.log('='.repeat(70));

  const standardColor = standardSuccessCount === streamScenarios.length ? 'green' : 'red';
  const standardEmoji = standardSuccessCount === streamScenarios.length ? '✅' : '❌';
  const enhancedColor = enhancedSuccessCount === streamScenarios.length ? 'green' : 'red';
  const enhancedEmoji = enhancedSuccessCount === streamScenarios.length ? '✅' : '❌';

  console.log(`\n${styleText(['bold', standardColor], `${standardEmoji} Standard streamText:`)} ${standardSuccessCount}/${streamScenarios.length} scenarios worked`);
  console.log(`${styleText(['bold', enhancedColor], `${enhancedEmoji} ai-sdk-ollama streamText:`)} ${enhancedSuccessCount}/${streamScenarios.length} scenarios worked`);

  const successRate = Math.round((enhancedSuccessCount / streamScenarios.length) * 100);
  console.log(`\n${styleText(['bold', 'magenta'], '🎯 Success rate:')} ${successRate}% with ai-sdk-ollama streamText`);

  console.log('\n' + styleText(['bold', 'cyan'], '💡 Key takeaways:'));
  console.log('• Standard streamText now works with ai-sdk-ollama provider!');
  console.log('• Both approaches execute tools and stream responses');
  console.log('• Enhanced streamText adds synthesis for more consistent streaming');
  console.log('• Use standard for compatibility, enhanced for guaranteed synthesis');

  console.log('\n' + '='.repeat(70));
  console.log(styleText(['bold', 'green'], '🚀 Get started:'));
  console.log('npm install ai-sdk-ollama');
  console.log('');
  console.log(styleText(['bold', 'cyan'], '⚡ Drop-in replacement:'));
  console.log('Just import streamText from ai-sdk-ollama instead of ai');
  console.log('100% compatible - same parameters, same API!');
  console.log('');
  console.log(styleText('dim', 'Learn more: https://github.com/jagreehal/ai-sdk-ollama'));
  console.log('='.repeat(70));
}

// Run the streaming comparison
runStreamingComparison().catch((error) => {
  console.error('Streaming comparison failed:', error);
  process.exit(1);
});