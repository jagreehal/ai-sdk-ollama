import { ollama } from 'ai-sdk-ollama';
import { streamText } from 'ai';

async function main() {
  console.log('=== Stream Reasoning Test ===\n');

  const model = ollama('deepseek-r1:latest', { think: true });

  const result = streamText({
    model,
    prompt: 'What is 2 + 2? Think step by step.',
  });

  for await (const part of result.fullStream) {
    console.log(`[${part.type}]`, 'delta' in part ? part.delta : '');
  }

  console.log('\n--- Done ---');
}

main().catch((error) => {
  console.error('Stream reasoning test failed:', error);
  process.exit(1);
});
