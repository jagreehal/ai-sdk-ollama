import { ollama } from 'ai-sdk-ollama';
import { embed } from 'ai';

async function testEmbedding() {
  try {
    console.log('🚀 Ollama Embedding Examples\n');
    console.log('='.repeat(50));

    // Example 1: Basic embedding without dimensions parameter
    console.log('\n📌 Example 1: Basic Embedding (Default Dimensions)');
    const { embedding } = await embed({
      model: ollama.embedding('nomic-embed-text'),
      value: 'Hello world',
    });
    console.log('Success! Embedding length:', embedding.length);
    console.log('First 5 values:', embedding.slice(0, 5));

    // Example 2: Embedding with custom dimensions parameter
    console.log('\n📌 Example 2: Custom Dimensions Parameter');
    console.log('Note: The dimensions parameter controls the output vector size\n');
    
    const { embedding: customEmbedding } = await embed({
      model: ollama.embedding('nomic-embed-text', {
        dimensions: 512, // Custom dimensions (if supported by the model)
      }),
      value: 'AI is transforming the world',
    });
    console.log('Custom dimensions embedding length:', customEmbedding.length);
    console.log('First 5 values:', customEmbedding.slice(0, 5));

    // Example 3: Multiple embeddings with different settings
    console.log('\n📌 Example 3: Multiple Embeddings with Different Settings');
    const texts = ['Hello world', 'How are you?', 'AI is amazing'];
    
    // Standard embeddings
    const standardResults = await Promise.all(
      texts.map((text) =>
        embed({
          model: ollama.embedding('nomic-embed-text'),
          value: text,
        }),
      ),
    );
    
    // Embeddings with custom dimensions
    const customResults = await Promise.all(
      texts.map((text) =>
        embed({
          model: ollama.embedding('nomic-embed-text', {
            dimensions: 256, // Smaller dimensions for faster processing
          }),
          value: text,
        }),
      ),
    );
    
    console.log('Standard embeddings:');
    for (let i = 0; i < standardResults.length; i++) {
      const result = standardResults[i];
      console.log(
        `  Text "${texts[i]}" -> ${result.embedding.length} dimensions`,
      );
    }
    
    console.log('\nCustom dimensions embeddings:');
    for (let i = 0; i < customResults.length; i++) {
      const result = customResults[i];
      console.log(
        `  Text "${texts[i]}" -> ${result.embedding.length} dimensions`,
      );
    }

    console.log('\n' + '='.repeat(50));
    console.log('\n✅ All embedding examples completed!');
    console.log('\n📚 Key Takeaways:');
    console.log('1. The dimensions parameter allows you to control embedding vector size');
    console.log('2. Smaller dimensions = faster processing, less storage');
    console.log('3. Larger dimensions = potentially better representation quality');
    console.log('4. The parameter is automatically passed through to Ollama');
    
  } catch (error) {
    console.error('Error:', error);
    if (error instanceof Error && error.message.includes('dimensions')) {
      console.log('\n💡 Note: The dimensions parameter may not be supported by all models.');
      console.log('   Check your model documentation for supported parameters.');
    }
    throw error;
  }
}

testEmbedding().catch((error) => {
  console.error('Embedding test failed:', error);
  process.exit(1);
});
