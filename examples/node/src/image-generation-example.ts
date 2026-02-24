/**
 * Ollama Image Generation Example (AI SDK way)
 *
 * Uses the AI SDK's generateImage() with the Ollama provider's image model.
 * Requires an image-capable Ollama model (e.g. x/z-image-turbo, x/flux2-klein).
 *
 * Prerequisites:
 *   - Ollama running (ollama serve)
 *   - Pull an image model: ollama pull x/z-image-turbo
 *   - Image generation is experimental; macOS supported first.
 *
 * @see https://ollama.com/blog/image-generation
 */

import { ollama } from 'ai-sdk-ollama';
import { generateImage } from 'ai';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';

function slugify(text: string): string {
  return text
    .slice(0, 40)
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase() || 'image';
}

async function main() {
  console.log('=== Ollama Image Generation (AI SDK) ===\n');
  console.log('Uses generateImage() from the AI SDK with ollama.imageModel().');
  console.log('Prerequisites: ollama pull x/flux2-klein\n');

  const modelId = process.env.OLLAMA_IMAGE_MODEL ?? 'x/flux2-klein';
  const prompt =
    process.argv[2] ??
    'A cozy coffee shop interior, warm lighting, wooden tables, plants';

  const outputDir = join(process.cwd(), 'output');
  await mkdir(outputDir, { recursive: true });

  try {
    console.log(`Model: ${modelId}`);
    console.log(`Prompt: ${prompt}\n`);
    console.log('Generating image...');

    const result = await generateImage({
      model: ollama.imageModel(modelId),
      prompt,
      n: 1,
      size: '1024x1024',
      // Optional: aspectRatio: '16:9', seed: 42
      // Ollama-specific options via providerOptions:
      // providerOptions: { ollama: { steps: 28, negative_prompt: '...' } },
    });

    const images = result.images;
    if (images.length === 0) {
      console.log('No images returned.');
      process.exit(1);
    }

    const ext = result.image.mediaType?.split('/')[1] ?? 'png';
    for (let i = 0; i < images.length; i++) {
      const name = `${slugify(prompt)}-${Date.now()}${images.length > 1 ? `-${i}` : ''}.${ext}`;
      const filePath = join(outputDir, name);
      await writeFile(filePath, Buffer.from(images[i].uint8Array));
      console.log(`Saved: ${filePath}`);
    }

    console.log('\nDone.');
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('Error:', message);
    if (message.includes('not found') || message.includes('404')) {
      console.log('\nPull the image model first: ollama pull x/flux2-klein');
      console.log('Image generation is experimental (macOS first).');
    }
    process.exit(1);
  }
}

main();
