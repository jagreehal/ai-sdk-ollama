import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateSpeech } from 'ai';
import { OllamaSpeechModel } from './speech-model';
import { createOllama } from '../provider';

const WAV = new Uint8Array([0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4]);

describe('OllamaSpeechModel', () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    mockFetch.mockReset();
    mockFetch.mockImplementation(
      async () =>
        new Response(WAV, {
          status: 200,
          headers: { 'content-type': 'audio/wav' },
        }),
    );
  });

  const createModel = () =>
    new OllamaSpeechModel('phonon:40m-multilingual', {
      provider: 'ollama.speech',
      baseURL: 'http://localhost:11434/',
      headers: () => ({ Authorization: 'Bearer k' }),
      fetch: mockFetch,
    });

  const lastRequest = () => {
    const [url, init] = mockFetch.mock.calls.at(-1)!;
    return { url, init, body: JSON.parse(init.body as string) };
  };

  it('posts to /v1/audio/speech with wav and the default voice', async () => {
    const result = await createModel().doGenerate({ text: 'Hello' });

    const { url, init, body } = lastRequest();
    expect(url).toBe('http://localhost:11434/v1/audio/speech');
    expect(init.headers).toMatchObject({ authorization: 'Bearer k' });
    expect(body).toEqual({
      model: 'phonon:40m-multilingual',
      input: 'Hello',
      voice: 'default',
      response_format: 'wav',
    });
    expect(result.audio).toEqual(WAV);
    expect(result.warnings).toEqual([]);
  });

  it('passes voice and pcm through', async () => {
    const result = await createModel().doGenerate({
      text: 'Hola',
      voice: 'Ximena',
      outputFormat: 'pcm',
    });

    expect(lastRequest().body).toMatchObject({
      voice: 'Ximena',
      response_format: 'pcm',
    });
    expect(result.warnings).toEqual([]);
  });

  it('warns instead of sending options Ollama rejects', async () => {
    const result = await createModel().doGenerate({
      text: 'Hello',
      outputFormat: 'mp3',
      speed: 1.5,
      instructions: 'cheerful',
      language: 'en',
    });

    const { body } = lastRequest();
    expect(body.response_format).toBe('wav');
    expect(body).not.toHaveProperty('speed');
    expect(body).not.toHaveProperty('instructions');
    expect(body).not.toHaveProperty('language');
    expect(
      result.warnings.map((w) => w.type === 'unsupported' && w.feature),
    ).toEqual(['outputFormat', 'speed', 'instructions', 'language']);
  });

  it('surfaces the Ollama error message', async () => {
    mockFetch.mockImplementation(async () =>
      Response.json(
        {
          error: { message: 'voice "nope" not found; available voices: Alba' },
        },
        { status: 400 },
      ),
    );

    await expect(
      createModel().doGenerate({ text: 'Hello', voice: 'nope' }),
    ).rejects.toThrow('voice "nope" not found; available voices: Alba');
  });

  it('works with generateSpeech through the provider', async () => {
    const ollama = createOllama({ fetch: mockFetch });
    const { audio } = await generateSpeech({
      model: ollama.speech('phonon'),
      text: 'Hello',
    });

    expect(audio.uint8Array).toEqual(WAV);
    expect(audio.mediaType).toBe('audio/wav');
    expect(lastRequest().url).toBe('http://127.0.0.1:11434/v1/audio/speech');
  });
});
