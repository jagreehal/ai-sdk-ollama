import { generateObject } from 'ai';
import { ollama } from 'ai-sdk-ollama';
import { z } from 'zod';

/**
 * Example demonstrating enhanced JSON repair for object generation with Ollama
 *
 * This example shows how the enhanced JSON repair automatically fixes
 * common JSON issues from LLM outputs.
 */

async function main() {
  console.log('🔧 JSON Repair Example\n');

  try {
    // Example 1: Basic object generation with automatic repair
    console.log('📝 Example 1: Basic object generation (repair enabled by default)');
    const result1 = await generateObject({
      model: ollama('llama3.2', {
        structuredOutputs: true,
        // Enhanced JSON repair is enabled by default
        reliableObjectGeneration: true,
      }),
      schema: z.object({
        name: z.string(),
        email: z.string().email(),
        age: z.number(),
        city: z.string(),
      }),
      prompt: 'Generate a person profile for John Doe, 30 years old, from New York',
    });

    console.log('✅ Generated object:', JSON.stringify(result1.object, null, 2));
    console.log();

    // Example 2: Complex nested object with automatic repair
    console.log('📝 Example 2: Complex nested object');
    const result2 = await generateObject({
      model: ollama('llama3.2', {
        structuredOutputs: true,
        reliableObjectGeneration: true,
      }),
      schema: z.object({
        recipe: z.object({
          name: z.string(),
          ingredients: z.array(
            z.object({
              name: z.string(),
              amount: z.string(),
            }),
          ),
          steps: z.array(z.string()),
          cookingTime: z.number().describe('Cooking time in minutes'),
        }),
      }),
      prompt: 'Generate a simple pasta recipe with at least 3 ingredients and 3 steps',
    });

    console.log('✅ Generated recipe:', JSON.stringify(result2.object, null, 2));
    console.log();

    // Example 3: Disable reliability (not recommended)
    console.log('📝 Example 3: Reliability disabled (may fail with malformed JSON)');
    try {
      const result3 = await generateObject({
        model: ollama('llama3.2', {
          structuredOutputs: true,
          reliableObjectGeneration: false, // Disable all reliability features
        }),
        schema: z.object({
          message: z.string(),
        }),
        prompt: 'Generate a simple message',
      });
      console.log('✅ Succeeded without reliability:', JSON.stringify(result3.object, null, 2));
    } catch (error) {
      console.log('❌ Failed (as expected):', (error as Error).message);
    }
    console.log();

    // Example 4: Fine-grained control - disable only repair, keep retries
    console.log('📝 Example 4: Retries enabled, repair disabled');
    try {
      const result4 = await generateObject({
        model: ollama('llama3.2', {
          structuredOutputs: true,
          reliableObjectGeneration: true,
          objectGenerationOptions: {
            enableTextRepair: false, // Disable repair only
            maxRetries: 3, // But keep retries
          },
        }),
        schema: z.object({
          message: z.string(),
        }),
        prompt: 'Generate a simple message',
      });
      console.log('✅ Succeeded with retries but no repair:', JSON.stringify(result4.object, null, 2));
    } catch (error) {
      console.log('❌ Failed:', (error as Error).message);
    }
    console.log();

    // Example 5: Custom repair function
    console.log('📝 Example 5: Using custom repair function');
    const result5 = await generateObject({
      model: ollama('llama3.2', {
        structuredOutputs: true,
        reliableObjectGeneration: true,
        objectGenerationOptions: {
          repairText: async ({ text, error }) => {
            console.log('  🔍 Custom repair function called');
            console.log('  📄 Original text:', text.slice(0, 100) + '...');
            console.log('  ❌ Error:', error.message);

            // Simple custom repair: just remove trailing comma
            const repaired = text.replace(/,(\s*[}\]])/g, '$1');
            return repaired;
          },
        },
      }),
      schema: z.object({
        title: z.string(),
        description: z.string(),
      }),
      prompt: 'Generate a title and description for a blog post about AI',
    });

    console.log('✅ Generated post:', JSON.stringify(result5.object, null, 2));
    console.log('\n✨ JSON repair examples completed!');
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('JSON repair example failed:', error);
  process.exit(1);
});
