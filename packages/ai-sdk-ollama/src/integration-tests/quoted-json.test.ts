import { describe, it, expect } from 'vitest';
import { generateText, Output } from 'ai';
import { ollama } from '../index';
import { z } from 'zod';

/**
 * Integration test for handling JSON wrapped in quotes
 *
 * This test verifies that the provider correctly handles cases where
 * the model returns JSON wrapped in quotes (e.g., "{\"key\": \"value\"}")
 * or in markdown code blocks, which was causing schema validation failures.
 *
 * Issue: https://github.com/jagreehal/ai-sdk-ollama/issues/440
 */
describe('Quoted JSON Handling', () => {
  it('should handle basic object generation with quoted JSON', async () => {
    // The model might return JSON wrapped in quotes, which should be handled correctly
    const result = await generateText({
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

    expect(result.output).toBeDefined();
    expect(result.output.name).toBeTruthy();
    expect(typeof result.output.name).toBe('string');
    expect(typeof result.output.age).toBe('number');
    expect(result.output.city).toBeTruthy();
    expect(typeof result.output.city).toBe('string');
    expect(result.output.age).toBeGreaterThan(0);
  });

  it('should handle complex nested object with quoted JSON', async () => {
    // Demonstrates that the fix works with nested structures
    const result = await generateText({
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

    expect(result.output).toBeDefined();
    expect(result.output.recipe).toBeDefined();
    expect(result.output.recipe.name).toBeTruthy();
    expect(typeof result.output.recipe.name).toBe('string');
    expect(Array.isArray(result.output.recipe.ingredients)).toBe(true);
    expect(Array.isArray(result.output.recipe.steps)).toBe(true);
    expect(result.output.recipe.ingredients.length).toBeGreaterThan(0);
    expect(result.output.recipe.steps.length).toBeGreaterThan(0);

    // Check ingredient structure
    for (const ingredient of result.output.recipe.ingredients) {
      expect(typeof ingredient.name).toBe('string');
      expect(typeof ingredient.amount).toBe('string');
    }

    // Check steps structure
    for (const step of result.output.recipe.steps) {
      expect(typeof step).toBe('string');
      expect(step.length).toBeGreaterThan(0);
    }
  });

  it('should handle array of objects with quoted JSON', async () => {
    // Shows that arrays are also handled correctly
    const result = await generateText({
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

    expect(result.output).toBeDefined();
    expect(Array.isArray(result.output.items)).toBe(true);
    expect(result.output.items.length).toBeGreaterThan(0);

    for (const item of result.output.items) {
      expect(typeof item.id).toBe('number');
      expect(typeof item.name).toBe('string');
      expect(typeof item.price).toBe('number');
      expect(item.name).toBeTruthy();
      expect(item.price).toBeGreaterThanOrEqual(0);
    }
  });

  it('should preserve string values that look like JSON', async () => {
    // Demonstrates that legitimate string values are not corrupted
    const result = await generateText({
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

    expect(result.output).toBeDefined();
    expect(typeof result.output.status).toBe('string');
    expect(typeof result.output.value).toBe('string');
    expect(typeof result.output.note).toBe('string');
    expect(result.output.status).toBeTruthy();
    expect(result.output.value).toBeTruthy();
    expect(result.output.note).toBeTruthy();
    // String values should be preserved, not converted to booleans/null
    expect(result.output.status).not.toBe(true);
    expect(result.output.value).not.toBe(null);
  });
});
