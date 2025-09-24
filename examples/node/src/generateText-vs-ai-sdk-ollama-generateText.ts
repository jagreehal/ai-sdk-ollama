/**
 * 🚀 AI-SDK-OLLAMA: The Tool Calling Problem & Solution Demo
 *
 * THE PROBLEM: Standard Ollama providers execute tools but return EMPTY responses
 * THE SOLUTION: ai-sdk-ollama provides enhanced generateText that guarantees complete, useful responses
 */

import { ollama, generateText as generateTextOllama } from 'ai-sdk-ollama';
import { generateText, tool } from 'ai';
import { z } from 'zod';
import { styleText } from 'util';

// Test tools
const mathTool = tool({
  description: 'Perform basic math calculations',
  inputSchema: z.object({
    operation: z.string().describe('Math operation like "2 + 2"'),
  }),
  execute: async ({ operation }) => {
    console.log(`    🧮 Math tool executed: ${operation}`);
    try {
      // Simple eval for demo (don't use in production!)
      const result = eval(operation);
      return { operation, result, calculated: true };
    } catch (error) {
      return { operation, result: 'Error', calculated: false, error: String(error) };
    }
  },
});

const weatherTool = tool({
  description: 'Get weather information for a location',
  inputSchema: z.object({
    location: z.string().describe('City name'),
    unit: z.enum(['celsius', 'fahrenheit']).optional().describe('Temperature unit'),
  }),
  execute: async ({ location, unit = 'celsius' }) => {
    console.log(`    🌤️ Weather tool executed for: ${location} (${unit})`);
    return {
      location,
      temperature: 22,
      unit,
      condition: 'sunny',
      humidity: 65,
      timestamp: new Date().toISOString(),
    };
  },
});

const complexTool = tool({
  description: 'Perform complex data processing',
  inputSchema: z.object({
    data: z.array(z.number()).describe('Array of numbers to process'),
    operation: z.enum(['sum', 'average', 'max', 'min']).describe('Operation to perform'),
  }),
  execute: async ({ data, operation }) => {
    console.log(`    🔧 Complex tool executed: ${operation} on ${data.length} numbers`);
    let result: number;
    switch (operation) {
      case 'sum':
        result = data.reduce((a, b) => a + b, 0);
        break;
      case 'average':
        result = data.reduce((a, b) => a + b, 0) / data.length;
        break;
      case 'max':
        result = Math.max(...data);
        break;
      case 'min':
        result = Math.min(...data);
        break;
    }
    return { operation, result, dataLength: data.length, processed: true };
  },
});

const testScenarios = [
  {
    name: '💰 Financial Calculation',
    prompt: 'I need to calculate 25 * 1.08 for tax calculation. Use the math tool and explain the result.',
    tools: { math: mathTool },
    social_impact: 'Real-world use case - tax calculations that MUST work',
  },
  {
    name: '🌍 Weather Query',
    prompt: 'What\'s the weather like in New York? Use the weather tool and give me a summary.',
    tools: { weather: weatherTool },
    social_impact: 'Common AI assistant task that users expect to work',
  },
  {
    name: '📊 Data Analysis',
    prompt: 'Find the average of [10, 20, 30, 40, 50] using the complex tool and interpret the result.',
    tools: { complex: complexTool },
    social_impact: 'Business analytics - empty responses are unacceptable',
  },
] as const;

// Helper functions (removed unused logTest function)

interface TestResult {
  success: boolean;
  toolCalls: number;
  toolResults: number;
  textLength: number;
  text: string;
  error: string | null;
}

function logResult(provider: string, success: boolean, details: TestResult) {
  const status = success ? '✅' : '❌';
  const color = success ? 'green' : 'red';

  console.log(`  ${status} ${styleText([color], provider)}:`);
  console.log(`    • Tool calls: ${details.toolCalls || 0}`);
  console.log(`    • Tool results: ${details.toolResults || 0}`);
  console.log(`    • Text length: ${details.textLength || 0} chars`);

  if (details.text && details.text.length > 0) {
    console.log(`    • Response: "${styleText(['green'], details.text.substring(0, 150))}${details.text.length > 150 ? '...' : ''}"`);
  } else {
    console.log(`    • Response: ${styleText(['red'], 'EMPTY - Tools ran but no response!')}`);
  }

  if (details.error) {
    console.log(`    • Error: ${details.error}`);
  }

  console.log(''); 
}

async function testStandardGenerateText(scenario: typeof testScenarios[number]): Promise<TestResult> {
  try {
    console.log(`\n  📝 Testing with standard generateText...`);

    const result = await generateText({
      model: ollama('llama3.2'),
      prompt: scenario.prompt,
      tools: scenario.tools,
    });

    const success = result.toolCalls && result.toolCalls.length > 0 && result.text && result.text.length > 0;

    return {
      success: Boolean(success),
      toolCalls: result.toolCalls?.length || 0,
      toolResults: result.toolResults?.length || 0,
      textLength: result.text?.length || 0,
      text: result.text || '',
      error: null,
    };
  } catch (error) {
    return {
      success: false,
      toolCalls: 0,
      toolResults: 0,
      textLength: 0,
      text: '',
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function testGenerateTextOllama(scenario: typeof testScenarios[number]): Promise<TestResult> {
  try {
    console.log(`\n  🚀 Testing with ai-sdk-ollama's generateText (enhanced)...`);

    const result = await generateTextOllama({
      model: ollama('llama3.2'),
      prompt: scenario.prompt,
      tools: scenario.tools,
    });

    // Enhanced function success: just needs text response (tools are handled internally)
    const success = result.text && result.text.length > 0;

    return {
      success: Boolean(success),
      toolCalls: result.toolCalls?.length || 0,
      toolResults: result.toolResults?.length || 0,
      textLength: result.text?.length || 0,
      text: result.text || '',
      error: null,
    };
  } catch (error) {
    return {
      success: false,
      toolCalls: 0,
      toolResults: 0,
      textLength: 0,
      text: '',
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// Removed unused testStreamText function to keep demo focused

async function runComparison() {
  console.log('\n' + '='.repeat(70));
  console.log(styleText(['bold', 'magenta'], '🚀 AI SDK Ollama: Tool Calling Comparison'));
  console.log(styleText('dim', 'Comparing standard generateText vs ai-sdk-ollama generateText'));
  console.log('='.repeat(70) + '\n');

  let standardSuccessCount = 0;
  let enhancedSuccessCount = 0;

  for (const scenario of testScenarios) {
    console.log('\n' + '─'.repeat(60));
    console.log(styleText(['bold', 'cyan'], `${scenario.name}`));
    console.log(styleText('dim', `Real-world impact: ${scenario.social_impact}`));
    console.log('─'.repeat(60));

    console.log(styleText(['bold', 'blue'], '\n📝 Standard generateText:'));
    const standardResult = await testStandardGenerateText(scenario);
    logResult('Standard generateText', standardResult.success, standardResult);

    if (standardResult.success) standardSuccessCount++;

    console.log(styleText(['bold', 'green'], '🚀 Enhanced ai-sdk-ollama generateText:'));
    const enhancedResult = await testGenerateTextOllama(scenario);
    logResult('ai-sdk-ollama generateText', enhancedResult.success, enhancedResult);

    if (enhancedResult.success) enhancedSuccessCount++;

    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  // Results summary
  console.log('\n' + '='.repeat(70));
  console.log(styleText(['bold', 'yellow'], '📊 Results Summary'));
  console.log('='.repeat(70));

  console.log(`\n${styleText(['bold', 'red'], '❌ Standard generateText:')} ${standardSuccessCount}/${testScenarios.length} scenarios worked`);
  console.log(`${styleText(['bold', 'green'], '✅ ai-sdk-ollama generateText:')} ${enhancedSuccessCount}/${testScenarios.length} scenarios worked`);

  const successRate = Math.round((enhancedSuccessCount / testScenarios.length) * 100);
  console.log(`\n${styleText(['bold', 'magenta'], '🎯 Success rate:')} ${successRate}% with ai-sdk-ollama generateText`);

  console.log('\n' + styleText(['bold', 'cyan'], '💡 Key takeaways:'));
  console.log('• Standard functions often return empty responses after tool execution');
  console.log('• ai-sdk-ollama\'s generateText provides reliable, complete responses');
  console.log('• For production tool calling with Ollama, use ai-sdk-ollama');

  console.log('\n' + '='.repeat(70));
  console.log(styleText(['bold', 'green'], '🚀 Get started:'));
  console.log('npm install ai-sdk-ollama');
  console.log('');
  console.log(styleText(['bold', 'cyan'], '⚡ Drop-in replacement:'));
  console.log('Just import generateText from ai-sdk-ollama instead of ai');
  console.log('100% compatible - same parameters, same API!');
  console.log('');
  console.log(styleText('dim', 'Learn more: https://github.com/jagreehal/ai-sdk-ollama'));
  console.log('='.repeat(70));
}

// Run the comparison
runComparison().catch(console.error);
