/**
 * AI SDK v7: raw provider chunks and raw usage
 *
 * Two v7 provider-spec features this provider now implements:
 *
 * 1. `include: { rawChunks: true }` on `streamText` — the model stream carries
 *    `{ type: 'raw', rawValue }` parts holding each unmodified Ollama chunk,
 *    so you can see fields the AI SDK does not normalise.
 *
 * 2. `usage.raw` — Ollama's own counters and nanosecond timings
 *    (`prompt_eval_count`, `eval_count`, `total_duration`, `load_duration`,
 *    `prompt_eval_duration`, `eval_duration`) alongside the normalised
 *    `usage.inputTokens` / `usage.outputTokens`.
 *
 * Run: pnpm --filter @examples/node exec tsx src/raw-chunks-and-usage-example.ts
 */
import { generateText, streamText } from 'ai';
import { LLAMA_3_2_MODEL as model } from './model';

async function usageRaw() {
  console.log('=== usage.raw (generateText) ===\n');

  const { text, usage, steps } = await generateText({
    model,
    prompt: 'Name one planet. Reply with just the name.',
  });

  // The top-level `usage` is summed across steps, and the AI SDK drops `raw`
  // when summing (provider-specific shapes can't be added). Read it per step.
  const raw = steps.at(-1)?.usage.raw;

  console.log(`answer: ${text.trim()}`);
  console.log(`normalised: in=${usage.inputTokens} out=${usage.outputTokens}`);
  console.log('last step usage.raw:', raw);

  if (raw === undefined) {
    throw new Error('expected usage.raw to be populated by the provider');
  }
}

async function rawChunks() {
  console.log('\n=== raw chunks (streamText) ===\n');

  const result = streamText({
    model,
    prompt: 'Count from 1 to 5, separated by spaces.',
    include: { rawChunks: true },
  });

  let rawCount = 0;
  let firstRaw: unknown;

  for await (const part of result.fullStream) {
    if (part.type === 'raw') {
      rawCount++;
      firstRaw ??= part.rawValue;
    }
  }

  console.log(`raw parts received: ${rawCount}`);
  console.log('first raw chunk:', firstRaw);

  // The streaming `finish` part now carries the same provider metadata that
  // `generateText` already returned (model, created_at, Ollama durations).
  const providerMetadata = await result.providerMetadata;
  console.log('stream providerMetadata.ollama:', providerMetadata?.ollama);

  if (providerMetadata?.ollama === undefined) {
    throw new Error('expected ollama provider metadata on the stream finish');
  }

  if (rawCount === 0) {
    throw new Error('expected raw chunks when include.rawChunks is set');
  }

  // Same prompt without the flag: no raw parts at all.
  const withoutFlag = streamText({
    model,
    prompt: 'Count from 1 to 5, separated by spaces.',
  });

  let unexpected = 0;
  for await (const part of withoutFlag.fullStream) {
    if (part.type === 'raw') unexpected++;
  }
  console.log(`raw parts without the flag: ${unexpected}`);

  if (unexpected !== 0) {
    throw new Error('raw chunks should be opt-in');
  }
}

async function main() {
  await usageRaw();
  await rawChunks();
  console.log('\nAll checks passed.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
