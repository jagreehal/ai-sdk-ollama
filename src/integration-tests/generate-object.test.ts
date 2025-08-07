import { describe, it, expect } from 'vitest';
import { generateObject } from 'ai';
import { ollama } from '../index';
import { z } from 'zod';

// Integration test for object generation
describe('Generate Object Integration Tests', () => {
  it('should generate structured object with recipe schema', async () => {
    const result = await generateObject({
      model: ollama('llama3.2', { structuredOutputs: true }),
      prompt: 'Generate a lasagna recipe.',
      schema: z.object({
        recipe: z.object({
          ingredients: z.array(
            z.object({
              amount: z.string(),
              name: z.string(),
            }),
          ),
          name: z.string(),
          steps: z.array(z.string()),
        }),
      }),
    });

    expect(result.object).toBeDefined();
    expect(result.object.recipe).toBeDefined();
    expect(result.object.recipe.name).toBeTruthy();
    expect(Array.isArray(result.object.recipe.ingredients)).toBe(true);
    expect(Array.isArray(result.object.recipe.steps)).toBe(true);
    expect(result.object.recipe.ingredients.length).toBeGreaterThan(0);
    expect(result.object.recipe.steps.length).toBeGreaterThan(0);

    // Check ingredient structure
    for (const ingredient of result.object.recipe.ingredients) {
      expect(typeof ingredient.amount).toBe('string');
      expect(typeof ingredient.name).toBe('string');
      if (!ingredient.amount) {
        console.warn(
          'Warning: Ingredient amount is empty. LLMs sometimes return empty fields.',
        );
      }
      if (!ingredient.name) {
        console.warn(
          'Warning: Ingredient name is empty. LLMs sometimes return empty fields.',
        );
      }
    }

    // Check steps structure
    for (const step of result.object.recipe.steps) {
      expect(typeof step).toBe('string');
      expect(step.length).toBeGreaterThan(0);
    }
  });

  it('should generate array of objects', async () => {
    const result = await generateObject({
      model: ollama('llama3.2', { structuredOutputs: true }),
      prompt:
        'Generate 3 character descriptions for a fantasy role playing game.',
      schema: z.object({
        characters: z.array(
          z.object({
            class: z
              .string()
              .describe('Character class, e.g. warrior, mage, or thief.'),
            description: z.string(),
            name: z.string(),
          }),
        ),
      }),
    });

    expect(result.object).toBeDefined();
    expect(Array.isArray(result.object.characters)).toBe(true);
    if (result.object.characters.length !== 3) {
      console.warn(
        'Warning: Model did not return exactly 3 characters. Got:',
        result.object.characters.length,
      );
    }
    expect(result.object.characters.length).toBeGreaterThan(0);

    for (const character of result.object.characters) {
      expect(character.name).toBeTruthy();
      expect(character.class).toBeTruthy();
      expect(character.description).toBeTruthy();
      expect(typeof character.name).toBe('string');
      expect(typeof character.class).toBe('string');
      expect(typeof character.description).toBe('string');
    }
  });

  it('should generate simple object with basic types', async () => {
    const result = await generateObject({
      model: ollama('llama3.2', { structuredOutputs: true }),
      prompt: 'Generate a person with name John, age 30, living in New York',
      schema: z.object({
        name: z.string(),
        age: z.number(),
        city: z.string(),
      }),
    });

    expect(result.object).toBeDefined();
    expect(result.object.name).toBeTruthy();
    expect(typeof result.object.age).toBe('number');
    expect(result.object.city).toBeTruthy();
    expect(result.object.age).toBeGreaterThan(0);
  });

  it('should handle nested object structures', async () => {
    const result = await generateObject({
      model: ollama('llama3.2', { structuredOutputs: true }),
      prompt: 'Generate a book with title, author, and publication details',
      schema: z.object({
        book: z.object({
          title: z.string(),
          author: z.object({
            name: z.string(),
            country: z.string(),
          }),
          publication: z.object({
            year: z.number(),
            publisher: z.string(),
          }),
        }),
      }),
    });

    expect(result.object).toBeDefined();
    expect(result.object.book).toBeDefined();
    expect(result.object.book.title).toBeTruthy();
    expect(result.object.book.author).toBeDefined();
    expect(result.object.book.author.name).toBeTruthy();
    expect(result.object.book.author.country).toBeTruthy();
    expect(result.object.book.publication).toBeDefined();
    expect(typeof result.object.book.publication.year).toBe('number');
    expect(result.object.book.publication.publisher).toBeTruthy();
  });

  it('should include usage and finish reason', async () => {
    const result = await generateObject({
      model: ollama('llama3.2', { structuredOutputs: true }),
      prompt: 'Generate a simple object with a message field',
      schema: z.object({
        message: z.string(),
      }),
    });

    expect(result.usage).toBeDefined();
    expect(result.usage.inputTokens).toBeGreaterThan(0);
    expect(result.usage.outputTokens).toBeGreaterThan(0);
    expect(result.finishReason).toBeDefined();
    expect(['stop', 'length', 'tool-calls']).toContain(result.finishReason);
  });
});
