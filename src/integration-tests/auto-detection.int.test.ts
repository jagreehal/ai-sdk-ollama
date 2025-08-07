import { describe, it, expect } from 'vitest';
import { generateObject, streamObject, generateText } from 'ai';
import { ollama } from '../index';
import { z } from 'zod';

// Integration test for auto-detection of structuredOutputs
describe.skipIf(!process.env.RUN_INTEGRATION_TESTS)(
  'Auto-Detection Integration Tests',
  () => {
    it('should auto-detect structuredOutputs for generateObject without explicit setting', async () => {
      const result = await generateObject({
        model: ollama('llama3.2'), // No structuredOutputs: true
        prompt: 'Generate a simple person with name Alice, age 25, city London',
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
    });

    it('should auto-detect structuredOutputs for streamObject without explicit setting', async () => {
      const result = streamObject({
        model: ollama('llama3.2'), // No structuredOutputs: true
        prompt: 'Generate a simple person with name Bob, age 30, city Paris',
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

      const finalObject = partialObjects.at(-1);
      expect(finalObject).toBeDefined();
      expect(finalObject).toHaveProperty('name');
      expect(finalObject).toHaveProperty('age');
      expect(finalObject).toHaveProperty('city');
      expect(typeof (finalObject as Record<string, unknown>).name).toBe(
        'string',
      );
      expect(typeof (finalObject as Record<string, unknown>).age).toBe(
        'number',
      );
      expect(typeof (finalObject as Record<string, unknown>).city).toBe(
        'string',
      );
    });

    it('should still work with explicit structuredOutputs: true', async () => {
      const result = await generateObject({
        model: ollama('llama3.2', { structuredOutputs: true }), // Explicit
        prompt:
          'Generate a simple person with name Charlie, age 35, city Berlin',
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
    });

    it('should not auto-detect for regular generateText calls', async () => {
      const result = await generateText({
        model: ollama('llama3.2'), // No structuredOutputs: true
        prompt: 'Say hello',
        maxOutputTokens: 20,
        temperature: 0,
      });

      expect(result.text).toBeTruthy();
      expect(result.text.toLowerCase()).toContain('hello');
    });

    it('should work with explicit structuredOutputs: false for object generation', async () => {
      // This should still work because auto-detection overrides explicit false
      const result = await generateObject({
        model: ollama('llama3.2', { structuredOutputs: false }), // Explicit false
        prompt: 'Generate a simple person with name David, age 40, city Rome',
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
    });

    it('should handle complex schemas with auto-detection', async () => {
      const result = await generateObject({
        model: ollama('llama3.2'), // No structuredOutputs: true
        prompt:
          'Generate a simple person with name, age, and a list of 3 hobbies',
        maxOutputTokens: 300, // More tokens for complex schema
        schema: z.object({
          person: z.object({
            name: z.string(),
            age: z.number(),
            hobbies: z.array(z.string()),
          }),
        }),
      });

      expect(result.object).toBeDefined();
      expect(result.object.person).toBeDefined();
      expect(result.object.person.name).toBeTruthy();
      expect(typeof result.object.person.age).toBe('number');
      expect(Array.isArray(result.object.person.hobbies)).toBe(true);
      expect(result.object.person.hobbies.length).toBe(3);
    }, 10_000); // 10 second timeout
  },
);
