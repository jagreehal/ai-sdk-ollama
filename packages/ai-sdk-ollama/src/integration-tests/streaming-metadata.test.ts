import { describe, it, expect } from 'vitest';
import { streamText, tool } from 'ai';
import { ollama } from '../index';
import { z } from 'zod';

describe('Streaming Metadata Integration Tests', { timeout: 120_000 }, () => {
  it('should track detailed streaming events and metadata', async () => {
    const result = streamText({
      model: ollama('llama3.2'),
      prompt: 'List 5 programming languages and briefly describe each',
      maxOutputTokens: 200,
      temperature: 0.3,
    });

    // Track different types of events
    let textDeltaEvents = 0;
    let finishEvents = 0;
    let totalChars = 0;
    const eventTypes: string[] = [];

    for await (const part of result.fullStream) {
      eventTypes.push(part.type);

      switch (part.type) {
        case 'text-delta': {
          textDeltaEvents++;
          totalChars += part.text.length;
          break;
        }
        case 'finish': {
          finishEvents++;
          expect(part.finishReason).toBeTruthy();
          expect(['stop', 'length', 'tool-calls']).toContain(part.finishReason);
          break;
        }
      }
    }

    // Metadata expectations
    expect(textDeltaEvents).toBeGreaterThan(0);
    expect(finishEvents).toBe(1); // Should have exactly one finish event
    expect(totalChars).toBeGreaterThan(20);
    expect(eventTypes).toContain('text-delta');
    expect(eventTypes).toContain('finish');

    // Get final usage information
    const finalUsage = await result.usage;
    expect(finalUsage).toBeDefined();
    expect(finalUsage?.inputTokens).toBeGreaterThan(0);
    expect(finalUsage?.outputTokens).toBeGreaterThan(0);
  });

  it('should capture streaming metadata with usage statistics', async () => {
    const result = streamText({
      model: ollama('llama3.2'),
      prompt: 'Explain the concept of recursion',
      maxOutputTokens: 150,
      temperature: 0.2,
    });

    const chunks: string[] = [];

    for await (const chunk of result.textStream) {
      chunks.push(chunk);
    }

    const fullText = chunks.join('');

    // Stream should have completed (for-await loop exited normally)
    expect(true).toBe(true);
    expect(chunks.length).toBeGreaterThan(0);
    expect(fullText.length).toBeGreaterThan(10);

    // Check usage metadata
    const usage = await result.usage;
    const finishReason = await result.finishReason;

    expect(usage).toBeDefined();
    expect(usage?.inputTokens).toBeGreaterThan(0);
    expect(usage?.outputTokens).toBeGreaterThan(0);
    expect(finishReason).toBeTruthy();
    expect(['stop', 'length']).toContain(finishReason);

    // Content should be about recursion
    expect(fullText.toLowerCase()).toMatch(/recursion|recursive|function|call/);
  });

  it('should track streaming events with tool calls', async () => {
    const result = streamText({
      model: ollama('llama3.2'),
      prompt: 'What is the weather in Paris? Use the weather tool.',
      maxOutputTokens: 100,
      tools: {
        getWeather: tool({
          description: 'Get weather for a city',
          inputSchema: z.object({
            city: z.string(),
          }),
          execute: async ({ city }) => {
            return { city, temperature: 20, condition: 'sunny' };
          },
        }),
      },
    });

    const eventLog: Array<{
      type: string;
      timestamp: number;
      data?: Record<string, unknown>;
    }> = [];
    const startTime = Date.now();

    for await (const part of result.fullStream) {
      eventLog.push({
        type: part.type,
        timestamp: Date.now() - startTime,
        data:
          part.type === 'tool-call'
            ? { toolName: part.toolName, input: part.input }
            : undefined,
      });
    }

    expect(eventLog.length).toBeGreaterThan(0);

    // Check for different event types
    const eventTypes = eventLog.map((e) => e.type);
    expect(eventTypes).toContain('finish');

    // Should have at least some text or tool events
    expect(
      eventTypes.some((type) => ['text-delta', 'tool-call'].includes(type)),
    ).toBe(true);

    // All events should have timestamps
    for (const event of eventLog) {
      expect(event.timestamp).toBeGreaterThanOrEqual(0);
    }
  });

  it('should measure streaming consistency and timing patterns', async () => {
    const result = streamText({
      model: ollama('llama3.2'),
      prompt: 'Write a step-by-step guide for making tea',
      maxOutputTokens: 150,
      temperature: 0.4,
    });

    const chunkTimings: Array<{
      chunk: string;
      timestamp: number;
      size: number;
    }> = [];
    const startTime = Date.now();

    for await (const chunk of result.textStream) {
      chunkTimings.push({
        chunk: chunk.slice(0, 20) + (chunk.length > 20 ? '...' : ''), // Truncate for logging
        timestamp: Date.now() - startTime,
        size: chunk.length,
      });
    }

    expect(chunkTimings.length).toBeGreaterThan(0);

    // Analyze timing patterns
    const delays = [];
    for (let i = 1; i < chunkTimings.length; i++) {
      delays.push(chunkTimings[i]!.timestamp - chunkTimings[i - 1]!.timestamp);
    }

    // Calculate statistics
    const totalSize = chunkTimings.reduce((sum, chunk) => sum + chunk.size, 0);
    const avgChunkSize = totalSize / chunkTimings.length;
    const maxDelay = delays.length > 0 ? Math.max(...delays) : 0;
    const avgDelay =
      delays.length > 0
        ? delays.reduce((sum, d) => sum + d, 0) / delays.length
        : 0;

    expect(totalSize).toBeGreaterThan(20);
    expect(avgChunkSize).toBeGreaterThan(0);
    expect(maxDelay).toBeGreaterThan(0);
    expect(maxDelay).toBeLessThan(10_000); // No chunk should take more than 10 seconds

    if (delays.length > 0) {
      expect(avgDelay).toBeGreaterThan(0);
      expect(avgDelay).toBeLessThan(5000); // Average delay under 5 seconds
    }

    console.log(
      `Streaming pattern: ${chunkTimings.length} chunks, ${Math.round(avgChunkSize)} avg size, ${Math.round(avgDelay)}ms avg delay`,
    );
  });

  it('should capture comprehensive stream metadata', async () => {
    const result = streamText({
      model: ollama('llama3.2'),
      prompt: 'Describe the solar system in 3 sentences',
      maxOutputTokens: 100,
      temperature: 0.3,
    });

    // Comprehensive metadata collection
    const metadata = {
      startTime: Date.now(),
      endTime: 0,
      chunks: 0,
      totalChars: 0,
      events: [] as string[],
      firstChunkTime: 0,
      lastChunkTime: 0,
    };

    for await (const part of result.fullStream) {
      if (metadata.chunks === 0) {
        metadata.firstChunkTime = Date.now() - metadata.startTime;
      }

      metadata.events.push(part.type);

      if (part.type === 'text-delta') {
        metadata.chunks++;
        metadata.totalChars += part.text.length;
        metadata.lastChunkTime = Date.now() - metadata.startTime;
      }
    }

    metadata.endTime = Date.now();
    const totalDuration = metadata.endTime - metadata.startTime;

    // Comprehensive metadata validation
    expect(metadata.chunks).toBeGreaterThan(0);
    expect(metadata.totalChars).toBeGreaterThan(10);
    expect(metadata.firstChunkTime).toBeGreaterThan(0);
    expect(metadata.lastChunkTime).toBeGreaterThanOrEqual(
      metadata.firstChunkTime,
    );
    expect(totalDuration).toBeGreaterThan(0);
    expect(metadata.events).toContain('finish');

    // Get final metadata from promises
    const finalUsage = await result.usage;
    const finishReason = await result.finishReason;

    expect(finalUsage).toBeDefined();
    expect(finishReason).toBeTruthy();

    // Log comprehensive metadata
    console.log(
      `Stream metadata: ${totalDuration}ms total, ${metadata.firstChunkTime}ms first chunk, ${metadata.chunks} chunks, ${metadata.totalChars} chars`,
    );
  });

  it('should handle streaming abort with metadata tracking', async () => {
    const abortController = new AbortController();
    let aborted = false;

    // Abort after 1.5 seconds
    setTimeout(() => {
      abortController.abort();
      aborted = true;
    }, 1500);

    const metadata = {
      chunksBeforeAbort: 0,
      charsBeforeAbort: 0,
      abortTime: 0,
      startTime: Date.now(),
    };

    try {
      const result = streamText({
        model: ollama('llama3.2'),
        prompt:
          'Write a very long story about space exploration with lots of details',
        maxOutputTokens: 500,
        abortSignal: abortController.signal,
      });

      for await (const chunk of result.textStream) {
        if (!aborted) {
          metadata.chunksBeforeAbort++;
          metadata.charsBeforeAbort += chunk.length;
        } else if (metadata.abortTime === 0) {
          metadata.abortTime = Date.now() - metadata.startTime;
        }
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        expect(aborted).toBe(true);
        expect(metadata.chunksBeforeAbort).toBeGreaterThanOrEqual(0); // May be 0 if aborted very quickly

        console.log(
          `Abort metadata: ${metadata.chunksBeforeAbort} chunks before abort, ${metadata.charsBeforeAbort} chars`,
        );
      } else {
        throw error;
      }
    }
  });

  it('should track streaming metadata across multiple concurrent requests', async () => {
    const prompts = [
      'Explain machine learning',
      'Describe the ocean',
      'What is quantum physics?',
    ];

    const results = await Promise.all(
      prompts.map(async (prompt, index) => {
        const startTime = Date.now();
        const result = streamText({
          model: ollama('llama3.2'),
          prompt,
          maxOutputTokens: 50,
          temperature: 0.2,
        });

        let chunks = 0;
        let chars = 0;

        for await (const chunk of result.textStream) {
          chunks++;
          chars += chunk.length;
        }

        const endTime = Date.now();
        const usage = await result.usage;

        return {
          index,
          prompt: prompt.slice(0, 20) + '...',
          duration: endTime - startTime,
          chunks,
          chars,
          inputTokens: usage?.inputTokens || 0,
          outputTokens: usage?.outputTokens || 0,
        };
      }),
    );

    // Validate all concurrent requests completed
    expect(results).toHaveLength(3);

    for (const [index, result] of results.entries()) {
      expect(result.index).toBe(index);
      expect(result.duration).toBeGreaterThan(0);
      expect(result.duration).toBeLessThan(60_000); // Each under 60 seconds
      expect(result.chunks).toBeGreaterThan(0);
      expect(result.chars).toBeGreaterThan(5);
      expect(result.inputTokens).toBeGreaterThan(0);
      expect(result.outputTokens).toBeGreaterThan(0);
    }

    console.log(`Concurrent streaming: ${results.length} requests completed`);
  });
});
