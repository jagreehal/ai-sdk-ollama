/**
 * Regression example for https://github.com/jagreehal/ai-sdk-ollama/pull/1083
 *
 * granite4.2:3b returns `message.thinking` even when `think` is not set. The
 * provider used to surface reasoning only when `think` was truthy, so returned
 * thinking was silently dropped. It is now preserved regardless of `think`,
 * which still controls generation - `think: false` yields no thinking at all.
 *
 * Requires: ollama pull granite4.2:3b
 */
import { generateText, streamText } from 'ai';
import { ollama } from 'ai-sdk-ollama';

const MODEL = 'granite4.2:3b';
const PROMPT = 'What is 2+2?';

async function report(label: string, think?: boolean) {
  const model = ollama(MODEL, think === undefined ? {} : { think });

  const generated = await generateText({ model, prompt: PROMPT });
  const reasoning = generated.reasoning
    .map((part) => (part.type === 'reasoning' ? part.text : ''))
    .join('')
    .trim();

  let streamedReasoning = '';
  const stream = streamText({ model, prompt: PROMPT });
  for await (const part of stream.fullStream) {
    if (part.type === 'reasoning-delta') streamedReasoning += part.text;
  }

  console.log(`\n=== ${label} ===`);
  console.log('generateText text     :', generated.text.slice(0, 60));
  console.log('generateText reasoning:', reasoning ? reasoning.slice(0, 60) : '(none)');
  console.log('streamText reasoning  :', streamedReasoning ? streamedReasoning.slice(0, 60) : '(none)');
  console.log('usage.outputTokens    :', JSON.stringify(generated.usage.outputTokens));
}

async function main() {
  await report('think omitted (server returns thinking anyway)');
  await report('think: true', true);
  await report('think: false', false);
}

main().catch((error) => {
  console.error('reasoning returned thinking example failed:', error);
  process.exit(1);
});
