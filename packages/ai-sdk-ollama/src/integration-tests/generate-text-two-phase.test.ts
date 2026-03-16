/**
 * Integration tests for the two-phase generateText path:
 * enableToolsWithStructuredOutput = true → Phase 1 (tools), Phase 2 (structured output).
 *
 * These tests call the real Ollama server and require a running instance.
 */

import { describe, it, expect } from 'vitest';
import { Output, tool } from 'ai';
import { z } from 'zod';
import { ollama } from '../index';
import { generateText } from '../functions/generate-text';

const ACTUAL_TEMPERATURE = 22;

const weatherTool = tool({
  description: 'Get current weather for a location',
  inputSchema: z.object({
    location: z.string().describe('City name'),
  }),
  execute: async ({ location }: { location: string }) => ({
    location,
    temperature: ACTUAL_TEMPERATURE,
    condition: 'sunny',
    humidity: 60,
  }),
});

const weatherSchema = z.object({
  location: z.string(),
  temperature: z.number(),
  condition: z.string(),
  summary: z.string(),
});

const weatherOutput = Output.object({ schema: weatherSchema });

describe('generateText – two-phase path (enableToolsWithStructuredOutput)', () => {
  it('preserves toolCalls/toolResults and returns structured output', async () => {
    const result = await generateText({
      model: ollama('llama3.2', { structuredOutputs: true }),
      prompt:
        'Get the weather for San Francisco and provide a structured summary.',
      tools: { getWeather: weatherTool },
      toolChoice: 'required',
      output: weatherOutput,
      enhancedOptions: { enableToolsWithStructuredOutput: true },
    });

    // Tool calls from Phase 1 must be preserved
    expect(Array.isArray(result.toolCalls)).toBe(true);
    expect(result.toolCalls.length).toBeGreaterThan(0);

    // Tool results from Phase 1 must be preserved
    expect(Array.isArray(result.toolResults)).toBe(true);
    expect(result.toolResults.length).toBeGreaterThan(0);

    // Structured output from Phase 2 must be present
    expect(result.output).toBeDefined();
    expect(typeof result.output.location).toBe('string');
    expect(typeof result.output.temperature).toBe('number');
    expect(typeof result.output.condition).toBe('string');
    expect(typeof result.output.summary).toBe('string');

    // The tool was actually executed with the real temperature value
    expect(result.output.temperature).toBe(ACTUAL_TEMPERATURE);
  });
});
