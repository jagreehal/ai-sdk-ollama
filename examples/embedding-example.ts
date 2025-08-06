import { ollama } from '../src';
import { embed } from 'ai';

async function testEmbedding() {
  try {
    console.log('Testing embedding with ollama provider...');
    const { embedding } = await embed({
      model: ollama.embedding('nomic-embed-text'),
      value: 'Hello world',
    });
    console.log('Success! Embedding length:', embedding.length);
    console.log('First 5 values:', embedding.slice(0, 5));

    // Test multiple embeddings
    console.log('\nTesting multiple embeddings...');
    const texts = ['Hello world', 'How are you?', 'AI is amazing'];
    const results = await Promise.all(
      texts.map((text) =>
        embed({
          model: ollama.embedding('nomic-embed-text'),
          value: text,
        }),
      ),
    );
    console.log(`Generated ${results.length} embeddings`);
    for (const [i, result] of results.entries()) {
      console.log(
        `  Text "${texts[i]}" -> ${result.embedding.length} dimensions`,
      );
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

testEmbedding();
