import { describe, it, expect } from 'vitest';
import { streamObject } from 'ai';
import { ollama } from '../index';
import { z } from 'zod';

// Integration test for streaming objects
describe('Stream Object Integration Tests', () => {
  it('should stream partial objects with character schema', async () => {
    const result = streamObject({
      maxOutputTokens: 2000,
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

    const partialObjects: Record<string, unknown>[] = [];
    for await (const partialObject of result.partialObjectStream) {
      partialObjects.push(partialObject);
    }

    expect(partialObjects.length).toBeGreaterThan(0);

    // Check the final object structure
    const finalObject = partialObjects.at(-1);
    expect(finalObject).toBeDefined();
    expect(finalObject).toHaveProperty('characters');
    expect(
      Array.isArray((finalObject as Record<string, unknown>).characters),
    ).toBe(true);
    expect((finalObject as Record<string, unknown>).characters).toHaveLength(3);

    const characters = (finalObject as Record<string, unknown>)
      .characters as Record<string, unknown>[];
    for (const character of characters) {
      expect(character.name).toBeTruthy();
      expect(character.class).toBeTruthy();
      expect(character.description).toBeTruthy();
    }
  });

  it('should stream partial objects with simple schema', async () => {
    const result = streamObject({
      model: ollama('llama3.2', { structuredOutputs: true }),
      prompt: 'Generate a person with name Alice, age 25, living in London',
      schema: z.object({
        name: z.string(),
        age: z.number(),
        city: z.string(),
      }),
    });

    const partialObjects: Record<string, unknown>[] = [];
    for await (const partialObject of result.partialObjectStream) {
      partialObjects.push(partialObject);
    }

    expect(partialObjects.length).toBeGreaterThan(0);

    // Check the final object
    const finalObject = partialObjects.at(-1);
    expect(finalObject).toBeDefined();
    expect(finalObject).toHaveProperty('name');
    expect(typeof (finalObject as Record<string, unknown>).age).toBe('number');
    expect(finalObject).toHaveProperty('city');
  });

  it('should stream partial objects with nested schema', async () => {
    const result = streamObject({
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

    const partialObjects: Record<string, unknown>[] = [];
    for await (const partialObject of result.partialObjectStream) {
      partialObjects.push(partialObject);
    }

    expect(partialObjects.length).toBeGreaterThan(0);

    // Check the final object
    const finalObject = partialObjects.at(-1);
    expect(finalObject).toBeDefined();
    expect(finalObject).toHaveProperty('book');
    const book = (finalObject as Record<string, unknown>).book as Record<
      string,
      unknown
    >;
    expect(book.title).toBeTruthy();
    expect(book.author).toBeDefined();
    expect((book.author as Record<string, unknown>).name).toBeTruthy();
    expect((book.author as Record<string, unknown>).country).toBeTruthy();
    expect(book.publication).toBeDefined();
    expect(typeof (book.publication as Record<string, unknown>).year).toBe(
      'number',
    );
    expect(
      (book.publication as Record<string, unknown>).publisher,
    ).toBeTruthy();
  });

  it('should provide usage and finish reason after streaming', async () => {
    const result = streamObject({
      model: ollama('llama3.2', { structuredOutputs: true }),
      prompt: 'Generate a simple object with a message field',
      schema: z.object({
        message: z.string(),
      }),
    });

    // Consume the stream
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    for await (const _partialObject of result.partialObjectStream) {
      // Just consume
    }

    // Check usage and finish reason
    const usage = await result.usage;
    const finishReason = await result.finishReason;

    expect(usage).toBeDefined();
    expect(usage.inputTokens).toBeGreaterThan(0);
    expect(usage.outputTokens).toBeGreaterThan(0);
    expect(finishReason).toBeDefined();
    expect(['stop', 'length', 'tool-calls']).toContain(finishReason);
  });

  it('should handle streaming with array schema', async () => {
    const result = streamObject({
      model: ollama('llama3.2', { structuredOutputs: true }),
      prompt: 'Generate a list of 3 colors',
      schema: z.object({
        colors: z.array(z.string()),
      }),
    });

    const partialObjects: Record<string, unknown>[] = [];
    for await (const partialObject of result.partialObjectStream) {
      partialObjects.push(partialObject);
    }

    expect(partialObjects.length).toBeGreaterThan(0);

    // Check the final object
    const finalObject = partialObjects.at(-1);
    expect(finalObject).toBeDefined();
    expect(finalObject).toHaveProperty('colors');
    expect(Array.isArray((finalObject as Record<string, unknown>).colors)).toBe(
      true,
    );
    expect((finalObject as Record<string, unknown>).colors).toHaveLength(3);

    const colors = (finalObject as Record<string, unknown>).colors as string[];
    for (const color of colors) {
      expect(typeof color).toBe('string');
      expect(color.length).toBeGreaterThan(0);
    }
  });

  it('should show progressive object building', async () => {
    const result = streamObject({
      model: ollama('llama3.2', { structuredOutputs: true }),
      prompt: 'Generate a person with name Bob, age 35, living in Paris',
      schema: z.object({
        name: z.string(),
        age: z.number(),
        city: z.string(),
      }),
    });

    const partialObjects: Record<string, unknown>[] = [];
    for await (const partialObject of result.partialObjectStream) {
      partialObjects.push({ ...partialObject }); // Clone to avoid reference issues
    }

    expect(partialObjects.length).toBeGreaterThan(1); // Should have multiple partial objects

    // Later objects should be more complete than earlier ones
    const lastObject = partialObjects.at(-1);

    // The last object should be complete
    expect(lastObject).toHaveProperty('name');
    expect(typeof (lastObject as Record<string, unknown>).age).toBe('number');
    expect(lastObject).toHaveProperty('city');
  });
});
