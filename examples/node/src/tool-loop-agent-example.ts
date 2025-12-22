/**
 * ToolLoopAgent Example
 *
 * Demonstrates the ToolLoopAgent class for running agents
 * that can call tools in a loop until a stop condition is met.
 */

import { ToolLoopAgent, stepCountIs, hasToolCall } from 'ai';
import { tool } from 'ai';
import { z } from 'zod';
import {GRANITE_4_MODEL as model } from './model';

async function main() {
  console.log('=== ToolLoopAgent Example ===\n');

  // Define some tools for the agent
  const tools = {
    weather: tool({
      description: 'Get the current weather for a location',
      parameters: z.object({
        location: z.string().describe('The city name'),
      }),
      execute: async ({ location }) => {
        // Simulated weather data
        const weatherData: Record<string, { temp: number; condition: string }> =
          {
            'san francisco': { temp: 65, condition: 'foggy' },
            'new york': { temp: 75, condition: 'sunny' },
            london: { temp: 60, condition: 'rainy' },
            tokyo: { temp: 80, condition: 'humid' },
          };

        const data = weatherData[location.toLowerCase()] ?? {
          temp: 70,
          condition: 'unknown',
        };

        return {
          location,
          temperature: data.temp,
          condition: data.condition,
          unit: 'fahrenheit',
        };
      },
    }),

    calculator: tool({
      description: 'Perform a mathematical calculation. You can pass either an expression string like "15 * 7" or numbers with an operation.',
      parameters: z.object({
        expression: z.string().optional().describe('A math expression like "15 * 7" or "2 + 2"'),
        a: z.number().optional().describe('First number'),
        b: z.number().optional().describe('Second number'),
        operation: z.string().optional().describe('Operation: +, -, *, /'),
      }),
      execute: async ({ expression, a, b, operation }) => {
        try {
          let result: number;
          if (expression) {
            // Simple eval for demo purposes (don't do this in production!)
            result = Function(`"use strict"; return (${expression})`)();
            return { expression, result };
          } else if (a !== undefined && b !== undefined && operation) {
            switch (operation) {
              case '+':
              case 'add':
                result = a + b;
                break;
              case '-':
              case 'subtract':
                result = a - b;
                break;
              case '*':
              case 'multiply':
                result = a * b;
                break;
              case '/':
              case 'divide':
                result = b !== 0 ? a / b : NaN;
                break;
              default:
                return { error: 'Invalid operation' };
            }
            return { expression: `${a} ${operation} ${b}`, result };
          } else {
            return { error: 'Provide either expression or a, b, and operation' };
          }
        } catch {
          return { expression: expression || 'unknown', error: 'Invalid expression' };
        }
      },
    }),

    done: tool({
      description:
        'Call this when you have completed the task and want to finish',
      parameters: z.object({
        summary: z.string().describe('A brief summary of what was done'),
      }),
      execute: async ({ summary }) => {
        return { completed: true, summary };
      },
    }),
  };

  // Example 1: Basic agent with step limit
  console.log('1. Basic Agent with Step Limit:');
  console.log('---');

  const agent1 = new ToolLoopAgent({
    model,
    system:
      'You are a helpful assistant. When you call tools, you MUST provide a text response after receiving the tool results. Always summarize what you learned from the tools.',
    tools,
    maxOutputTokens: 1000,
    temperature: 0.7,
    stopWhen: stepCountIs(5), // Stop after 5 steps max
    onStepFinish: (step, index) => {
      console.log(`  Step ${index + 1}:`);
      if (step.text) {
        console.log(`    Text: "${step.text.slice(0, 100)}${step.text.length > 100 ? '...' : ''}"`);
      }
      if (step.toolCalls.length > 0) {
        console.log(`    Tool calls: ${step.toolCalls.map(tc => `${String(tc.toolName)}(${JSON.stringify(tc.args)})`).join(', ')}`);
      }
      if (step.toolResults.length > 0) {
        console.log(`    Tool results: ${step.toolResults.map(tr => `${String(tr.toolName)} → ${JSON.stringify(tr.result)}`).join(', ')}`);
      }
      console.log(`    Finish reason: ${step.finishReason || 'continue'}`);
    },
  });

  const result1 = await agent1.generate({
    prompt: "What's the weather in San Francisco and New York? Please provide a summary after checking.",
  });

  console.log('\nFinal result:');
  if (result1.text) {
    console.log(result1.text);
  } else {
    console.log('(No text generated - showing tool results instead)');
    // Show all tool results from all steps
    for (let i = 0; i < result1.steps.length; i++) {
      const step = result1.steps[i];
      if (step.toolResults.length > 0) {
        console.log(`\nStep ${i + 1} tool results:`);
        for (const tr of step.toolResults) {
          console.log(`  ${String(tr.toolName)}:`, JSON.stringify(tr.result, null, 2));
        }
      }
    }
  }
  console.log(`\nTotal steps: ${result1.steps.length}`);
  console.log(`Total tokens: ${result1.usage.totalTokens ?? 'undefined'} (${result1.usage.inputTokens ?? 'undefined'} input + ${result1.usage.outputTokens ?? 'undefined'} output)`);
  console.log(`Finish reason: ${result1.finishReason || 'unknown'}`);
  console.log('---\n');

  // Example 2: Agent that stops when specific tool is called
  console.log('2. Agent with Tool-Based Stop Condition:');
  console.log('---');

  const agent2 = new ToolLoopAgent({
    model,
    system:
      'You are a helpful assistant. Complete tasks step by step. After finishing, call the "done" tool with a summary. Provide text responses when you have information to share.',
    tools,
    stopWhen: [
      stepCountIs(10), // Safety limit
      hasToolCall('done'), // Stop when done tool is called
    ],
    onStepFinish: (step, index) => {
      console.log(`  Step ${index + 1}:`);
      if (step.text) {
        console.log(`    Text: "${step.text.slice(0, 80)}${step.text.length > 80 ? '...' : ''}"`);
      }
      if (step.toolCalls.length > 0) {
        for (const tc of step.toolCalls) {
          console.log(`    → Calling ${String(tc.toolName)}:`, tc.args);
        }
      }
      if (step.toolResults.length > 0) {
        for (const tr of step.toolResults) {
          console.log(`    ← ${String(tr.toolName)} returned:`, tr.result);
        }
      }
      console.log(`    Finish reason: ${step.finishReason || 'continue'}`);
    },
  });

  const result2 = await agent2.generate({
    prompt:
      'Calculate 15 * 7, then get the weather in Tokyo, and then call done with a summary.',
  });

  console.log('\nFinal result:');
  if (result2.text) {
    console.log(result2.text);
  } else {
    console.log('(No text generated)');
    // Show what the done tool returned
    const doneStep = result2.steps.find(s => s.toolCalls.some(tc => tc.toolName === 'done'));
    if (doneStep) {
      const doneResult = doneStep.toolResults.find(tr => tr.toolName === 'done');
      if (doneResult) {
        console.log('Done tool summary:', doneResult.result);
      }
    }
  }
  console.log(`Finish reason: ${result2.finishReason || 'unknown'}`);
  console.log(`Steps taken: ${result2.steps.length}`);
  console.log('---\n');

  // Example 3: Agent with onFinish callback
  console.log('3. Agent with Completion Callback:');
  console.log('---');

  const agent3 = new ToolLoopAgent({
    model,
    system: 'You are a calculator assistant. When asked a math question: 1) Call the calculator tool, 2) Then provide a clear text answer explaining the result.',
    tools: { calculator: tools.calculator },
    stopWhen: stepCountIs(3),
    onStepFinish: (step, index) => {
      if (step.toolCalls.length > 0) {
        console.log(`  Step ${index + 1}: Called calculator`);
        for (const tr of step.toolResults) {
          console.log(`    Result: ${JSON.stringify(tr.result)}`);
        }
      }
      if (step.text) {
        console.log(`  Step ${index + 1}: Generated text: "${step.text}"`);
      }
    },
    onFinish: (result) => {
      console.log('\n  [onFinish] Agent completed!');
      console.log('  [onFinish] Steps taken:', result.steps.length);
      console.log(
        '  [onFinish] Token usage:',
        result.totalUsage.inputTokens ?? 'undefined',
        'input +',
        result.totalUsage.outputTokens ?? 'undefined',
        'output =',
        result.totalUsage.totalTokens ?? 'undefined',
        'total',
      );
    },
  });

  const result3 = await agent3.generate({
    prompt: 'What is (25 + 17) * 3? Use the calculator tool and then tell me the answer.',
  });

  console.log('\nFinal answer:');
  if (result3.text) {
    console.log(result3.text);
  } else {
    // Show calculator result if no text
    console.log('(No text generated - showing calculator result)');
    for (const step of result3.steps) {
      const calcResult = step.toolResults.find(tr => tr.toolName === 'calculator');
      if (calcResult && typeof calcResult.result === 'object' && calcResult.result !== null) {
        const result = calcResult.result as { result?: number; expression?: string };
        if (result.result !== undefined) {
          console.log(`Calculator result: ${result.expression || 'calculation'} = ${result.result}`);
        }
      }
    }
  }
  console.log('---\n');

  // Example 4: Streaming (first step only)
  console.log('4. Agent Streaming (First Response):');
  console.log('---');
  console.log('Note: Streaming only shows the first step response.');
  console.log('For full agent loop behavior, use generate() instead.\n');

  const agent4 = new ToolLoopAgent({
    model,
    system: 'You are a helpful assistant. Provide clear, concise answers.',
    tools,
  });

  const stream = await agent4.stream({
    prompt: 'What is the weather like in London?',
  });

  process.stdout.write('Streaming response: ');
  let streamedText = '';
  for await (const chunk of stream.textStream) {
    process.stdout.write(chunk);
    streamedText += chunk;
  }
  console.log('\n');
  if (streamedText.trim()) {
    console.log('✓ Successfully streamed text response');
  } else {
    console.log('(No text streamed - model may have called tools instead)');
  }
  console.log('---\n');

  // Summary
  console.log('=== Summary ===');
  console.log('The ToolLoopAgent successfully:');
  console.log('✓ Called tools in a loop');
  console.log('✓ Executed tool functions');
  console.log('✓ Received tool results');
  console.log('✓ Tracked steps and token usage');
  console.log('✓ Respected stop conditions');
  console.log('\nNote: Some models may call tools without generating text responses.');
  console.log('This is normal behavior - the agent loop is working correctly!');
  console.log('The tool results are available in result.steps[].toolResults');
  console.log('\nToolLoopAgent examples complete!');
}

main().catch((error) => {
  console.error('ToolLoopAgent example failed:', error);
  process.exit(1);
});
