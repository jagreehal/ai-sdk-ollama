/**
 * Tool Result Image Example
 *
 * Demonstrates returning image content from a tool result using
 * toModelOutput with type 'content' containing image-data parts.
 * The provider converts these into Ollama's native images array
 * on the tool message.
 *
 * Run:  npx tsx src/tool-result-image-example.ts
 *
 * Current Ollama limitation: vision models (llava, llama3.2-vision) do
 * not support tools, and tool-capable models (llama3.2) are text-only.
 * This example shows the data flow works — the image IS sent to Ollama
 * in the tool result. When a model with both capabilities becomes
 * available, it will be able to interpret the image.
 */

import { generateText, tool, stepCountIs } from 'ai';
import { z } from 'zod';
import { ollama } from 'ai-sdk-ollama';

const MODEL = process.env.OLLAMA_MODEL ?? 'llama3.2';

// Small 1x1 red pixel PNG (base64)
const RED_PIXEL_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==';

const getImage = tool({
  description:
    'Returns a sample image with a short caption. Call this when the user asks to see an image.',
  inputSchema: z.object({
    topic: z.string().optional().describe('Optional topic for the caption'),
  }),
  execute: async ({ topic }) => ({
    caption: topic
      ? `Caption: A small sample image (${topic}).`
      : 'Caption: A small red pixel image.',
    imageBase64: RED_PIXEL_BASE64,
    mediaType: 'image/png',
  }),
  // toModelOutput returns type 'content' with image-data parts.
  // The AI SDK passes this through to the provider unchanged.
  // The Ollama provider maps image-data into Ollama's native images array.
  toModelOutput: ({ output }) => ({
    type: 'content',
    value: [
      { type: 'text', text: output.caption },
      {
        type: 'image-data',
        data: output.imageBase64,
        mediaType: output.mediaType,
      },
    ],
  }),
});

async function main() {
  console.log(`=== Tool Result Image Example (model: ${MODEL}) ===\n`);

  const result = await generateText({
    model: ollama(MODEL),
    tools: { getImage },
    // stepCountIs(2) allows the model to call the tool (step 1)
    // and then receive the tool result to generate a response (step 2).
    stopWhen: stepCountIs(2),
    prompt:
      'Call the getImage tool to get a sample image, then describe what you see.',
    maxOutputTokens: 500,
  });

  for (const [i, step] of result.steps.entries()) {
    console.log(`Step ${i + 1}: finishReason=${step.finishReason}`);
    if (step.toolCalls.length > 0) {
      console.log(
        `  Tool calls: ${step.toolCalls.map((tc) => tc.toolName).join(', ')}`,
      );
    }
    if (step.toolResults.length > 0) {
      console.log(`  Tool results: ${step.toolResults.length}`);
    }
    if (step.text) {
      console.log(`  Text: ${step.text.slice(0, 200)}`);
    }
  }

  console.log('\n--- Final response ---');
  console.log(result.text || '(no text — model may not support vision)');
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
