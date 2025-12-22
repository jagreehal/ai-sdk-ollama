/**
 * Smooth Stream Example
 *
 * Demonstrates how to use smoothStream for smoother text streaming output.
 * This utility chunks text into words, lines, or custom patterns for a
 * more natural streaming experience.
 */

import { streamText, smoothStream } from 'ai';
import { GRANITE_4_MODEL as model } from './model';

async function main() {
  console.log('=== Smooth Stream Example ===\n');

  // Example 1: Word-by-word streaming (default)
  console.log('1. Word-by-word streaming:');
  console.log('---');

  const result1 = streamText({
    model,
    prompt: 'Write a short poem about the ocean.',
    experimental_transform: smoothStream({
      delayInMs: 50, // 50ms delay between chunks
      chunking: 'word', // Chunk by words
    }),
  });

  for await (const chunk of result1.textStream) {
    process.stdout.write(chunk);
  }
  console.log('\n---\n');

  // Example 2: Line-by-line streaming
  console.log('2. Line-by-line streaming:');
  console.log('---');

  const result2 = streamText({
    model,
    prompt: 'List 5 interesting facts about space, one per line.',
    experimental_transform: smoothStream({
      delayInMs: 100, // 100ms delay between lines
      chunking: 'line', // Chunk by lines
    }),
  });

  for await (const chunk of result2.textStream) {
    process.stdout.write(chunk);
  }
  console.log('\n---\n');

  // Example 3: Custom regex chunking (sentences)
  console.log('3. Sentence-by-sentence streaming:');
  console.log('---');

  const result3 = streamText({
    model,
    prompt: 'Explain what machine learning is in 3 sentences.',
    experimental_transform: smoothStream({
      delayInMs: 200, // 200ms delay between sentences
      chunking: /[.!?]\s+/, // Chunk by sentence endings
    }),
  });

  for await (const chunk of result3.textStream) {
    process.stdout.write(chunk);
  }
  console.log('\n---\n');

  // Example 4: Fast streaming without delays
  console.log('4. Fast word streaming (no delay):');
  console.log('---');

  const result4 = streamText({
    model,
    prompt: 'Say hello world in a creative way.',
    experimental_transform: smoothStream({
      delayInMs: 0, // No delay
      chunking: 'word',
    }),
  });

  for await (const chunk of result4.textStream) {
    process.stdout.write(chunk);
  }
  console.log('\n---\n');

  console.log('Smooth stream examples complete!');
}

main().catch((error) => {
  console.error('Smooth stream example failed:', error);
  process.exit(1);
});
