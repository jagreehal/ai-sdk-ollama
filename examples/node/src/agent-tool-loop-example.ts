/**
 * AI SDK v7: `ToolLoopAgent` + `isStepCount`
 *
 * `ToolLoopAgent` is the new v7 agent abstraction: a reusable object that
 * bundles a model, instructions, tools, and a stop condition. It runs the
 * tool-calling loop for you until the `stopWhen` condition is met.
 *
 * `isStepCount(n)` is the v7 stop-condition helper (renamed from `stepCountIs`).
 *
 * Run: pnpm --filter @examples/node exec tsx src/agent-tool-loop-example.ts
 */
import { ollama } from 'ai-sdk-ollama';
import { ToolLoopAgent, isStepCount, tool } from 'ai';
import { z } from 'zod';
import { MODELS } from './model';

const calculator = tool({
  description:
    'Evaluate a single arithmetic operation on two numbers. Always use this for math.',
  inputSchema: z.object({
    a: z.number(),
    b: z.number(),
    op: z.enum(['add', 'subtract', 'multiply', 'divide']),
  }),
  execute: async ({ a, b, op }) => {
    const result =
      op === 'add'
        ? a + b
        : op === 'subtract'
          ? a - b
          : op === 'multiply'
            ? a * b
            : a / b;
    return { result };
  },
});

const weather = tool({
  description: 'Get the current weather for a city.',
  inputSchema: z.object({ city: z.string() }),
  execute: async ({ city }) => ({ city, tempC: 21, condition: 'sunny' }),
});

// Define the agent once and reuse it across calls.
const agent = new ToolLoopAgent({
  model: ollama(MODELS.LLAMA_3_2),
  instructions:
    'You are a concise assistant. Use the calculator tool for any arithmetic ' +
    'and the weather tool for any weather question. After using tools, give a short final answer.',
  tools: { calculator, weather },
  // Stop after at most 5 steps (model call + tool round-trips).
  stopWhen: isStepCount(5),
});

async function main() {
  console.log('=== ToolLoopAgent (v7) ===\n');

  const result = await agent.generate({
    prompt: 'What is 23 multiplied by 7, and what is the weather in Paris?',
  });

  console.log(`Steps taken: ${result.steps.length}`);
  const toolCalls = result.steps.flatMap((step) => step.toolCalls);
  for (const call of toolCalls) {
    console.log(`  → called ${call.toolName}(${JSON.stringify(call.input)})`);
  }

  console.log(`\nFinal answer:\n${result.text}`);
  console.log(`\nfinishReason: ${result.finishReason}`);
  console.log(`usage: ${JSON.stringify(result.usage)}`);
}

main().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
