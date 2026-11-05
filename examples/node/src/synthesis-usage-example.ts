/**
 * Synthesis and token usage
 *
 * When a run ends on a tool call, the `generateText` and `streamText` wrappers
 * from `ai-sdk-ollama` make one more model call to write the answer. `usage`,
 * `text`, and with `streamText` the `finish` part and `onEnd`, include that call.
 *
 * `stopWhen: isStepCount(1)` ends the run straight after the tool call, so each
 * section below reaches synthesis. Each one throws if the numbers disagree.
 *
 * Run: pnpm --filter @examples/node exec tsx src/synthesis-usage-example.ts
 */
import { isStepCount, Output, tool, type LanguageModelUsage } from 'ai';
import { generateText, streamText } from 'ai-sdk-ollama';
import { z } from 'zod';
import { LLAMA_3_2_MODEL as model } from './model';

const prompt =
  'Use the getTemperature tool for Paris, then tell me the result.';

const tools = {
  getTemperature: tool({
    description: 'Get the current temperature for a city.',
    inputSchema: z.object({ city: z.string() }),
    execute: async ({ city }) => ({ city, celsius: 21 }),
  }),
};

function check(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const stepInputTokens = (steps: Array<{ usage: LanguageModelUsage }>) =>
  steps.reduce((sum, step) => sum + (step.usage.inputTokens ?? 0), 0);

function report(usage: LanguageModelUsage, stepTokens: number) {
  console.log(`tokens from the tool steps: ${stepTokens}`);
  console.log(`tokens in usage:            ${usage.inputTokens}`);
  check(
    (usage.inputTokens ?? 0) > stepTokens,
    'expected usage to include the synthesis call',
  );
  check(
    usage.inputTokenDetails.noCacheTokens === usage.inputTokens,
    'expected the token details to match the total',
  );
}

async function streamFullStream() {
  console.log('=== streamText: fullStream, onEnd and result getters ===\n');

  const ended: Array<{ text: string; usage: LanguageModelUsage }> = [];
  const result = await streamText({
    model,
    prompt,
    tools,
    stopWhen: isStepCount(1),
    onEnd: (event) => {
      ended.push(event);
    },
  });

  const finishes: Array<{ totalUsage: LanguageModelUsage }> = [];
  let lastType = '';
  for await (const part of result.fullStream) {
    lastType = part.type;
    if (part.type === 'finish') finishes.push(part);
  }

  const usage = await result.usage;
  const text = await result.text;
  console.log(`answer: ${text.trim()}`);
  report(usage, stepInputTokens(await result.steps));

  check(finishes.length === 1, 'expected one finish part');
  check(lastType === 'finish', 'expected finish to be the last part');
  check(text.length > 0, 'expected result.text to hold the synthesized answer');
  check(ended.length === 1, 'expected onEnd to fire once');
  check(ended[0]?.text === text, 'expected onEnd to see the same text');
  check(
    finishes[0]?.totalUsage.inputTokens === usage.inputTokens &&
      ended[0]?.usage.inputTokens === usage.inputTokens,
    'expected finish, onEnd and usage to agree',
  );
}

async function streamWhileReadingUsage() {
  console.log('\n=== streamText: usage read while the text streams ===\n');

  const result = await streamText({
    model,
    prompt,
    tools,
    stopWhen: isStepCount(1),
  });

  const drain = async () => {
    let text = '';
    for await (const chunk of result.textStream) text += chunk;
    return text;
  };

  const [streamed, usage] = await Promise.all([drain(), result.usage]);
  console.log(`answer: ${streamed.trim()}`);
  report(usage, stepInputTokens(await result.steps));
  check(streamed === (await result.text), 'expected text to match the stream');
}

async function generate() {
  console.log('\n=== generateText: synthesis ===\n');

  const result = await generateText({
    model,
    prompt,
    tools,
    stopWhen: isStepCount(1),
  });

  console.log(`answer: ${result.text.trim()}`);
  report(result.usage, stepInputTokens(result.steps));
}

async function generateStructured() {
  console.log('\n=== generateText: tools with structured output ===\n');

  const result = await generateText({
    model,
    prompt,
    tools,
    toolChoice: 'required',
    output: Output.object({
      schema: z.object({ city: z.string(), celsius: z.number() }),
    }),
    enhancedOptions: { enableToolsWithStructuredOutput: true },
  });

  console.log('answer:', result.output);
  // `steps` covers the second phase only, so its tokens are the lower bound.
  report(result.usage, stepInputTokens(result.steps));
}

async function main() {
  await streamFullStream();
  await streamWhileReadingUsage();
  await generate();
  await generateStructured();
  console.log('\nAll checks passed.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
