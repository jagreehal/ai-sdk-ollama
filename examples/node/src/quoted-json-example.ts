import { generateText, Output } from 'ai';
import { ollama } from 'ai-sdk-ollama';
import { z } from 'zod';

/**
 * Example demonstrating the fix for JSON wrapped in quotes
 *
 * This example shows how the provider now correctly handles cases where
 * the model returns JSON wrapped in quotes (e.g., "{\"key\": \"value\"}")
 * or in markdown code blocks, which was causing schema validation failures.
 *
 * Issue: https://github.com/jagreehal/ai-sdk-ollama/issues/440
 */

async function main() {
  console.log('🔧 Quoted JSON Fix Example\n');
  console.log(
    'This example demonstrates the fix for JSON wrapped in quotes or markdown.\n',
  );

  try {
    // Example 1: Basic object generation
    // The model might return JSON wrapped in quotes, which is now handled correctly
    console.log('📝 Example 1: Basic object generation');
    console.log(
      '   (Handles JSON wrapped in quotes: "{\\"key\\": \\"value\\"}")\n',
    );

    const result1 = await generateText({
      model: ollama('llama3.2', {
        structuredOutputs: true,
      }),
      output: Output.object({
        schema: z.object({
          name: z.string(),
          age: z.number(),
          city: z.string(),
        }),
      }),
      prompt:
        'Generate a person profile: name "Alice", age 28, city "San Francisco". Return as JSON.',
    });

    console.log('✅ Generated object:', JSON.stringify(result1.output, null, 2));
    console.log();

    // Example 2: Complex nested object
    // Demonstrates that the fix works with nested structures
    console.log('📝 Example 2: Complex nested object');
    console.log('   (Handles nested JSON wrapped in quotes)\n');

    const result2 = await generateText({
      model: ollama('llama3.2', {
        structuredOutputs: true,
      }),
      output: Output.object({
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
          }),
        }),
      }),
      prompt:
        'Generate a simple pasta recipe. Return the recipe as a JSON object.',
    });

    console.log('✅ Generated recipe:', JSON.stringify(result2.output, null, 2));
    console.log();

    // Example 3: Array of objects
    // Shows that arrays are also handled correctly
    console.log('📝 Example 3: Array of objects');
    console.log('   (Handles arrays wrapped in quotes)\n');

    const result3 = await generateText({
      model: ollama('llama3.2', {
        structuredOutputs: true,
      }),
      output: Output.object({
        schema: z.object({
          items: z.array(
            z.object({
              id: z.number(),
              name: z.string(),
              price: z.number(),
            }),
          ),
        }),
      }),
      prompt:
        'Generate a list of 3 products with id, name, and price. Return as JSON array.',
    });

    console.log('✅ Generated items:', JSON.stringify(result3.output, null, 2));
    console.log();

    // Example 4: String values that look like JSON
    // Demonstrates that legitimate string values are not corrupted
    console.log('📝 Example 4: String values preserved');
    console.log(
      '   (String values like "True", "None", "False" are preserved)\n',
    );

    const result4 = await generateText({
      model: ollama('llama3.2', {
        structuredOutputs: true,
      }),
      output: Output.object({
        schema: z.object({
          status: z.string(),
          value: z.string(),
          note: z.string(),
        }),
      }),
      prompt:
        'Generate an object with status="True", value="None", and note="/* keep this */". Return as JSON.',
    });

    console.log('✅ Generated object:', JSON.stringify(result4.output, null, 2));
    console.log('   Note: String values should be preserved, not converted.\n');

    // Example 5: Array type coercion test (Issue #440 follow-up)
    // Tests the new type coercion when model returns raw array but schema expects {elements: [...]}
    console.log('📝 Example 5: Array type coercion');
    console.log(
      '   (Handles when model returns raw array but schema expects wrapped format)\n',
    );

    const result5 = await generateText({
      model: ollama('llama3.2', {
        structuredOutputs: true,
      }),
      output: Output.object({
        schema: z.object({
          results: z.array(
            z.object({
              status: z.enum(['passed', 'failed', 'skipped']),
              message: z.string(),
              id: z.string(),
            }),
          ),
        }),
      }),
      prompt:
        'Generate test results: 3 items with status (passed/failed/skipped), message, and id. Return as JSON.',
    });

    console.log(
      '✅ Generated test results:',
      JSON.stringify(result5.output, null, 2),
    );
    console.log();

    console.log('✨ All examples completed successfully!');
    console.log(
      '\n💡 The fix ensures that:\n' +
        '   - JSON wrapped in quotes is correctly parsed\n' +
        '   - JSON in markdown code blocks is extracted\n' +
        '   - String values are not corrupted during repair\n' +
        '   - Non-object schemas (string, number, array) are handled correctly\n' +
        '   - Array/object type mismatches are coerced to match the schema',
    );
  } catch (error) {
    console.error('❌ Error:', error);
    if (error instanceof Error) {
      console.error('   Message:', error.message);
    }
    process.exit(1);
  }
}

main().catch(console.error);
