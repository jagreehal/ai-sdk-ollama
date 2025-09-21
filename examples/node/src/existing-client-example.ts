import { Ollama } from 'ollama';
import { createOllama } from 'ai-sdk-ollama';
import { generateText, streamText, embed } from 'ai';

async function main() {
  console.log('=== Using Existing Ollama Client ===\n');

  // Create an existing Ollama client with custom configuration
  const existingClient = new Ollama({
    host: 'http://127.0.0.1:11434',
    // You can add custom headers, fetch implementation, etc.
  });

  // Create AI SDK provider using the existing client
  const ollamaSdk = createOllama({ client: existingClient });

  try {
    // Use the raw client for direct Ollama operations
    console.log('1. Listing available models with raw client:');
    const models = await existingClient.list();
    console.log(`Found ${models.models.length} models:`);
    models.models.forEach((model) => {
      console.log(
        `  - ${model.name} (${(model.size / 1024 / 1024 / 1024).toFixed(2)} GB)`,
      );
    });

    // Use the AI SDK provider for AI operations
    console.log('\n2. Generating text with AI SDK:');
    const { text } = await generateText({
      model: ollamaSdk('llama3.2'),
      prompt: 'What is the capital of France?',
    });
    console.log('Answer:', text);

    // Streaming with AI SDK
    console.log('\n3. Streaming text with AI SDK:');
    const { textStream } = await streamText({
      model: ollamaSdk('llama3.2'),
      prompt: 'Write a short poem about coding',
    });

    process.stdout.write('Streaming: ');
    for await (const chunk of textStream) {
      process.stdout.write(chunk);
    }
    console.log('\n');

    // Embeddings with AI SDK
    console.log('4. Creating embeddings with AI SDK:');
    const { embedding } = await embed({
      model: ollamaSdk.embedding('nomic-embed-text'),
      value: 'Hello world',
    });
    console.log(`Embedding dimensions: ${embedding.length}`);
    console.log(`First few values: [${embedding.slice(0, 5).join(', ')}...]`);

    // Using raw client for model operations
    console.log('\n5. Getting model info with raw client:');
    try {
      // Note: Model info retrieval may vary based on Ollama version
      console.log('Model info retrieval skipped due to type compatibility');
    } catch (error) {
      console.log('Model info not available (model might not be pulled)');
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

main().catch(console.error);
