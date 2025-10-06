import { ollama } from 'ai-sdk-ollama';
import { generateText, streamText, embed } from 'ai';
import { model } from './model';

async function main() {
  // Basic text generation
  console.log('=== Basic Text Generation ===');
  const { text } = await generateText({
    model,
    prompt: 'What is the capital of France?',
  });
  console.log(text);

  // Streaming text
  console.log('\n=== Streaming Text ===');
  const { textStream } = await streamText({
    model: ollama('llama3.2'),
    prompt: 'Write a short poem about coding',
  });

  for await (const chunk of textStream) {
    process.stdout.write(chunk);
  }
  console.log('\n');

  // Embeddings (AI SDK v5 takes single value, not array)
  console.log('\n=== Embeddings ===');
  const { embedding } = await embed({
    model: ollama.embedding('nomic-embed-text'),
    value: 'Hello world',
  });
  console.log('Embedding dimensions:', embedding.length);
  console.log('First few values:', embedding.slice(0, 5));

  // With custom settings
  console.log('\n=== Custom Settings ===');
  const { text: customText } = await generateText({
    model: ollama('llama3.2', {
      options: {
        temperature: 0.1,
        num_predict: 50,
      },
    }),
    prompt: 'Complete this: The quick brown fox',
  });
  console.log(customText);
}

main().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
