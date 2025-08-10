import { ollama } from 'ai-sdk-ollama';
import { generateText, streamText } from 'ai';

async function main() {
  // Basic text generation
  console.log('=== Basic Text Generation ===');
  const { text } = await generateText({
    model: ollama('gpt-oss:20b'),
    prompt: 'What is the capital of France?',
  });
  console.log(text);

  // Streaming text
  console.log('\n=== Streaming Text ===');
  const { textStream } = await streamText({
    model: ollama('gpt-oss:20b'),
    prompt: 'Write a short poem about coding',
  });

  for await (const chunk of textStream) {
    process.stdout.write(chunk);
  }
  console.log('\n');
}

main().catch(console.error);
