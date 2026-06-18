/**
 * AI SDK v7: per-call `reasoning` effort
 *
 * v7 adds a standard `reasoning` option to `generateText` / `streamText` /
 * `ToolLoopAgent`. This provider maps it onto Ollama's `think` parameter, so you
 * can control reasoning effort per request (overriding the model-level `think`
 * setting):
 *
 *   'none'                 -> think: false   (disable thinking)
 *   'minimal' | 'low'      -> think: 'low'
 *   'medium'               -> think: 'medium'
 *   'high'   | 'xhigh'     -> think: 'high'
 *   'provider-default'     -> use the model's `think` setting
 *
 * Requires a reasoning-capable model (e.g. qwen3.5, deepseek-r1, gpt-oss).
 *
 * Run: pnpm --filter @examples/node exec tsx src/reasoning-effort-example.ts
 */
import { ollama } from 'ai-sdk-ollama';
import { generateText, streamText } from 'ai';
import { MODELS } from './model';

// No `think` setting here; the per-call `reasoning` option controls effort.
const model = ollama(MODELS.QWEN_3_5);

async function generateWith(reasoning: 'none' | 'low' | 'high') {
  const { text, reasoningText } = await generateText({
    model,
    reasoning,
    prompt: 'What is 12 * 13? Reply with just the number.',
  });
  console.log(
    `  reasoning='${reasoning}' → reasoning chars: ${(reasoningText ?? '').length}, answer: ${text.replace(/\s+/g, ' ').trim().slice(0, 40)}`,
  );
}

async function main() {
  console.log('=== Per-call reasoning effort (v7) ===\n');

  console.log('generateText:');
  await generateWith('none'); // thinking disabled
  await generateWith('low'); // light thinking
  await generateWith('high'); // full thinking

  // The same option works while streaming.
  console.log('\nstreamText (reasoning="high"):');
  const stream = streamText({
    model,
    reasoning: 'high',
    prompt: 'Is 91 a prime number? Think, then answer yes or no.',
  });

  let reasoningChars = 0;
  for await (const part of stream.fullStream) {
    if (part.type === 'reasoning-delta') reasoningChars += part.text.length;
  }
  console.log(`  streamed reasoning chars: ${reasoningChars}`);
  console.log(`  answer: ${(await stream.text).replace(/\s+/g, ' ').trim()}`);
}

main().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
