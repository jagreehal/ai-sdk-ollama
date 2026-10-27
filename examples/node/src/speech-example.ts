/**
 * AI SDK v7: `generateSpeech` with an Ollama text-to-speech model
 *
 * Phonon turns text into 24 kHz mono WAV locally. Requires Ollama 0.40.9+ on
 * Apple Silicon.
 *
 * Setup: ollama pull phonon:40m-multilingual
 * Run: pnpm --filter @examples/node exec tsx src/speech-example.ts
 */
import { writeFile } from 'node:fs/promises';
import { ollama } from 'ai-sdk-ollama';
import { generateSpeech } from 'ai';

const lines = [
  { voice: 'Hugh', text: 'Good morning. Here is a short update.' },
  { voice: 'Lucien', text: 'Bonjour, voici votre résumé du matin.' },
  { voice: 'Ximena', text: 'Buenos días, este es tu resumen de la mañana.' },
];

for (const { voice, text } of lines) {
  const { audio } = await generateSpeech({
    model: ollama.speech('phonon:40m-multilingual'),
    text,
    voice,
  });
  const file = `speech-${voice.toLowerCase()}.wav`;
  await writeFile(file, audio.uint8Array);
  console.log(`${voice}: ${file} (${audio.uint8Array.length} bytes)`);
}
