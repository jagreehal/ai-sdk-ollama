import { ollama } from 'ai-sdk-ollama';
import { generateText } from 'ai';

/**
 * This example demonstrates the dual parameter support of the ai-sdk-ollama provider:
 * 1. AI SDK standard parameters for cross-provider compatibility
 * 2. Native Ollama options for advanced features and future compatibility
 * 3. Hybrid approach where both can be used together
 */

async function main() {
  console.log('🚀 Dual Parameter Support Examples\n');
  console.log('='.repeat(50));

  // Example 1: AI SDK Standard Parameters (Cross-Provider Compatible)
  console.log('\n📌 Example 1: AI SDK Standard Parameters');
  console.log(
    'These parameters work with any AI SDK provider (OpenAI, Anthropic, etc.)\n',
  );

  try {
    const { text: standardText } = await generateText({
      model: ollama('llama3.2'),
      prompt: 'Write a haiku about coding',

      // Standard AI SDK parameters - portable across providers
      temperature: 0.7, // Creativity control
      maxOutputTokens: 100, // Maximum tokens to generate
      topP: 0.9, // Nucleus sampling
      topK: 40, // Top-k sampling
      seed: 42, // Reproducible output
      stopSequences: ['---'], // Stop generation at these sequences
    });

    console.log('Response using AI SDK parameters:');
    console.log(standardText);
  } catch (error) {
    console.error('Error:', error);
    throw error;
  }

  // Example 2: Native Ollama Options (Ollama-Specific Features)
  console.log('\n' + '='.repeat(50));
  console.log('\n📌 Example 2: Native Ollama Options');
  console.log(
    'These options are Ollama-specific and provide advanced control\n',
  );

  try {
    const { text: ollamaText } = await generateText({
      model: ollama('llama3.2', {
        options: {
          // Ollama-specific parameters
          temperature: 0.8, // Ollama native temperature
          num_ctx: 4096, // Context window size (Ollama-specific)
          num_predict: 100, // Max tokens (Ollama naming)
          top_k: 30, // Top-k sampling
          top_p: 0.85, // Top-p sampling

          // Advanced Ollama-only features
          repeat_penalty: 1.1, // Penalize repetition
          repeat_last_n: 64, // Look-back for repetition
          mirostat: 2, // Mirostat sampling algorithm
          mirostat_tau: 5, // Target entropy
          mirostat_eta: 0.1, // Learning rate

          // System options
          seed: 123, // Random seed
          numa: false, // NUMA support
          num_thread: 4, // CPU threads

          // Future Ollama parameters will work automatically!
          // No provider updates needed
        },
      }),
      prompt: 'Write a haiku about AI',
    });

    console.log('Response using native Ollama options:');
    console.log(ollamaText);
  } catch (error) {
    console.error('Error:', error);
    throw error;
  }

  // Example 3: Hybrid Approach (Both AI SDK + Ollama Options)
  console.log('\n' + '='.repeat(50));
  console.log('\n📌 Example 3: Hybrid Approach');
  console.log('Combine AI SDK parameters with Ollama options');
  console.log('Note: Ollama options take precedence when both are specified\n');

  try {
    const { text: hybridText, usage } = await generateText({
      model: ollama('llama3.2', {
        options: {
          // Ollama-specific advanced features
          num_ctx: 8192, // Larger context window
          repeat_penalty: 1.2, // Stronger repetition penalty
          mirostat: 1, // Different Mirostat mode

          // This will override the AI SDK temperature below
          temperature: 0.5,
        },
      }),
      prompt: 'Explain quantum computing in one sentence',

      // AI SDK standard parameters
      temperature: 0.9, // Will be overridden by Ollama option (0.5)
      maxOutputTokens: 50, // Will be mapped to num_predict
      topP: 0.95, // Will be passed as top_p
      seed: 999, // Will be passed to Ollama
    });

    console.log('Response using hybrid approach:');
    console.log(hybridText);
    console.log(
      `\nTokens used: ${usage.inputTokens} input, ${usage.outputTokens} output`,
    );
  } catch (error) {
    console.error('Error:', error);
    throw error;
  }

  // Example 4: Future Compatibility Demo
  console.log('\n' + '='.repeat(50));
  console.log('\n📌 Example 4: Future Compatibility');
  console.log(
    'Any future Ollama parameters will work without provider updates!\n',
  );

  try {
    const { text: futureText } = await generateText({
      model: ollama('llama3.2', {
        options: {
          temperature: 0.7,

          // These hypothetical future parameters would work automatically
          // when Ollama adds them - no provider update needed!
          // (Currently these will be passed but may not have effect)
          experimental_feature_x: true,
          new_sampling_method: 'advanced',
          future_optimization: 2.5,
          quantum_mode: false,

          // The provider passes ALL options directly to Ollama
          // ensuring immediate compatibility with new features
        } as Record<string, unknown>, // Using type assertion to demonstrate future parameters
      }),
      prompt: 'What is the future of AI?',
      maxOutputTokens: 30,
    });

    console.log('Response demonstrating future compatibility:');
    console.log(futureText);
  } catch (error) {
    console.error('Error:', error);
    throw error;
  }

  console.log('\n' + '='.repeat(50));
  console.log('\n✅ All examples completed!');
  console.log('\n📚 Key Takeaways:');
  console.log('1. Use AI SDK parameters for cross-provider compatibility');
  console.log(
    '2. Use Ollama options for advanced features and Ollama-specific control',
  );
  console.log(
    '3. Combine both for maximum flexibility (Ollama options take precedence)',
  );
  console.log(
    '4. Future Ollama parameters work automatically without provider updates',
  );
}

main().catch((error) => {
  console.error('Dual parameter example failed:', error);
  process.exit(1);
});
