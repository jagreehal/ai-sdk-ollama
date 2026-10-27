import { describe, it, expect } from 'vitest';
import { generateSpeech } from 'ai';
import { ollama } from '../index';

// Requires Ollama 0.40.9+ on Apple Silicon and `ollama pull phonon:40m-multilingual`.
describe.skipIf(process.platform !== 'darwin' || process.arch !== 'arm64')(
  'Speech (Phonon) Integration Tests',
  { timeout: 120_000 },
  () => {
    it('returns 24 kHz mono WAV in a named voice', async () => {
      const { audio, warnings } = await generateSpeech({
        model: ollama.speech('phonon:40m-multilingual'),
        text: 'Bonjour, voici votre résumé du matin.',
        voice: 'Lucien',
      });

      const bytes = audio.uint8Array;
      const view = new DataView(bytes.buffer, bytes.byteOffset);
      expect(audio.mediaType).toBe('audio/wav');
      expect(new TextDecoder().decode(bytes.slice(0, 4))).toBe('RIFF');
      expect(view.getUint16(22, true)).toBe(1); // channels
      expect(view.getUint32(24, true)).toBe(24_000); // sample rate
      expect(bytes.length).toBeGreaterThan(10_000);
      expect(warnings).toEqual([]);
    });

    it('rejects an unknown voice with the list of voices', async () => {
      await expect(
        generateSpeech({
          model: ollama.speech('phonon:40m-multilingual'),
          text: 'Hello',
          voice: 'not-a-voice',
        }),
      ).rejects.toThrow(/available voices/);
    });
  },
);
