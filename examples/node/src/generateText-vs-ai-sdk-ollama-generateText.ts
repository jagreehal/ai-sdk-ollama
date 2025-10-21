/**
 * 🚀 AI-SDK-OLLAMA: Tool Calling Enhancement Demo
 *
 * GOOD NEWS: ai-sdk-ollama now works with standard AI SDK generateText!
 * - Tools execute properly ✅
 * - Multi-turn conversations work ✅
 * - Text responses are generated ✅
 *
 * EVEN BETTER: ai-sdk-ollama's enhanced generateText provides synthesis for more reliable responses
 * - Some Ollama models occasionally return empty text after tool execution
 * - The enhanced version adds intelligent synthesis to guarantee useful responses
 * - This comparison shows both approaches working
 */

import { ollama, generateText as generateTextOllama } from 'ai-sdk-ollama';
import { generateText, tool, stepCountIs } from 'ai';
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
      stopWhen: stepCountIs(5), // Enable multi-turn tool calling
    });

    // Check if tools were called in ANY step (not just the last one)
    const toolsWereCalled = result.steps?.some(step =>
      step.toolCalls && step.toolCalls.length > 0
    ) ?? false;

    const success = toolsWereCalled && result.text && result.text.length > 0;

    // Count total tool calls across all steps
    const totalToolCalls = result.steps?.reduce((sum, step) =>
      sum + (step.toolCalls?.length || 0), 0
    ) || 0;

    const totalToolResults = result.steps?.reduce((sum, step) =>
      sum + (step.toolResults?.length || 0), 0
    ) || 0;

    return {
      success: Boolean(success),
      toolCalls: totalToolCalls,
      toolResults: totalToolResults,
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

    // Check if tools were called in ANY step (not just the last one)
    const toolsWereCalled =
      result.steps?.some((step) => step.toolCalls && step.toolCalls.length > 0) ??
      false;

    // Count total tool calls across all steps
    const totalToolCalls =
      result.steps?.reduce((sum, step) => sum + (step.toolCalls?.length || 0), 0) ||
      0;

    const totalToolResults =
      result.steps?.reduce(
        (sum, step) => sum + (step.toolResults?.length || 0),
        0,
      ) || 0;

    const success = result.text && result.text.length > 0;

    return {
      success: Boolean(success),
      toolCalls: totalToolCalls,
      toolResults: totalToolResults,
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
  console.log(styleText('dim', 'Standard AI SDK vs Enhanced with Synthesis'));
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

  const standardColor = standardSuccessCount === testScenarios.length ? 'green' : 'red';
  const standardEmoji = standardSuccessCount === testScenarios.length ? '✅' : '❌';
  const enhancedColor = enhancedSuccessCount === testScenarios.length ? 'green' : 'red';
  const enhancedEmoji = enhancedSuccessCount === testScenarios.length ? '✅' : '❌';

  console.log(`\n${styleText(['bold', standardColor], `${standardEmoji} Standard generateText:`)} ${standardSuccessCount}/${testScenarios.length} scenarios worked`);
  console.log(`${styleText(['bold', enhancedColor], `${enhancedEmoji} ai-sdk-ollama generateText:`)} ${enhancedSuccessCount}/${testScenarios.length} scenarios worked`);

  const successRate = Math.round((enhancedSuccessCount / testScenarios.length) * 100);
  console.log(`\n${styleText(['bold', 'magenta'], '🎯 Success rate:')} ${successRate}% with ai-sdk-ollama generateText`);

  console.log('\n' + styleText(['bold', 'cyan'], '💡 Key takeaways:'));
  console.log('• Standard generateText now works with ai-sdk-ollama provider!');
  console.log('• Both approaches execute tools and generate responses');
  console.log('• Enhanced generateText adds synthesis for more consistent results');
  console.log('• Use standard for compatibility, enhanced for guaranteed synthesis');

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
runComparison().catch((error) => {
  console.error('Comparison failed:', error);
  process.exit(1);
});
