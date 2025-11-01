import { beforeEach, vi, type Mock } from 'vitest';

// Mock console methods during tests to avoid noise
beforeEach(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

// Global test utilities
export const createMockResponse = (data: unknown): Response => {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};

export const createMockStreamResponse = (chunks: string[]): Response => {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk));
      }
      controller.close();
    },
  });

  return new Response(stream, {
    status: 200,
    headers: { 'Content-Type': 'application/x-ndjson' },
  });
};

export const mockFetch: Mock = vi.fn();

// Set up global fetch mock
globalThis.fetch = mockFetch;
