import { describe, it, expect } from 'vitest';
import { generateObject, streamObject, jsonSchema } from 'ai';
import { ollama } from '../index';

describe('JSON Schema Integration Tests', { timeout: 120_000 }, () => {
  it('should generate object with jsonSchema helper', async () => {
    const schema = jsonSchema<{
      name: string;
      age: number;
      email?: string;
    }>({
      type: 'object',
      properties: {
        name: { type: 'string' },
        age: { type: 'number' },
        email: { type: 'string' },
      },
      required: ['name', 'age'],
    });

    const result = await generateObject({
      model: ollama('llama3.2'),
      prompt: 'Generate a person named John who is 30 years old',
      schema,
      temperature: 0,
    });

    expect(result.object).toBeDefined();
    expect(result.object.name).toBeTruthy();
    expect(typeof result.object.name).toBe('string');
    expect(typeof result.object.age).toBe('number');
  });

  it('should stream object with jsonSchema', async () => {
    const schema = jsonSchema<{
      title: string;
      completed: boolean;
    }>({
      type: 'object',
      properties: {
        title: { type: 'string' },
        completed: { type: 'boolean' },
      },
      required: ['title', 'completed'],
    });

    const result = await streamObject({
      model: ollama('llama3.2'),
      prompt: 'Generate a todo item for grocery shopping',
      schema,
      temperature: 0,
    });

    const chunks: Record<string, unknown>[] = [];
    for await (const chunk of result.partialObjectStream) {
      chunks.push(chunk);
    }

    expect(chunks.length).toBeGreaterThan(0);
    const finalObject = chunks.at(-1);
    expect(finalObject).toHaveProperty('title');
    expect(typeof (finalObject as Record<string, unknown>).completed).toBe(
      'boolean',
    );
  });

  it('should handle enum in jsonSchema', async () => {
    const schema = jsonSchema<{
      status: 'pending' | 'in_progress' | 'completed';
      priority: number;
    }>({
      type: 'object',
      properties: {
        status: {
          type: 'string',
          enum: ['pending', 'in_progress', 'completed'],
        },
        priority: {
          type: 'number',
          minimum: 1,
          maximum: 5,
        },
      },
      required: ['status', 'priority'],
    });

    const result = await generateObject({
      model: ollama('llama3.2'),
      prompt: 'Generate a task with high priority that is in progress',
      schema,
      temperature: 0,
    });

    expect(result.object).toBeDefined();
    expect(['pending', 'in_progress', 'completed']).toContain(
      result.object.status,
    );
    expect(result.object.priority).toBeGreaterThanOrEqual(1);
    expect(result.object.priority).toBeLessThanOrEqual(5);
  });
});
