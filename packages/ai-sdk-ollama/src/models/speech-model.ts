import type {
  SharedV4Warning,
  SpeechModelV4,
  SpeechModelV4CallOptions,
} from '@ai-sdk/provider';
import {
  combineHeaders,
  createBinaryResponseHandler,
  createJsonErrorResponseHandler,
  FetchFunction,
  postJsonToApi,
} from '@ai-sdk/provider-utils';
import { z } from 'zod';

export interface OllamaSpeechModelConfig {
  provider: string;
  baseURL: string;
  headers: () => Record<string, string>;
  fetch?: FetchFunction;
}

// The OpenAI-compatible endpoints wrap errors as { error: { message } }.
const ollamaSpeechFailedResponseHandler = createJsonErrorResponseHandler({
  errorSchema: z.object({
    error: z.union([z.string(), z.object({ message: z.string() })]),
  }),
  errorToMessage: (data) =>
    typeof data.error === 'string' ? data.error : data.error.message,
});

const SUPPORTED_OUTPUT_FORMATS = ['wav', 'pcm'];

/**
 * Ollama text-to-speech model (SpeechModelV4), e.g. `phonon`.
 * Uses POST /v1/audio/speech. Requires Ollama 0.40.9+ on Apple Silicon.
 */
export class OllamaSpeechModel implements SpeechModelV4 {
  readonly specificationVersion = 'v4' as const;
  readonly provider: string;

  constructor(
    readonly modelId: string,
    private readonly config: OllamaSpeechModelConfig,
  ) {
    this.provider = config.provider;
  }

  async doGenerate({
    text,
    voice = 'default',
    outputFormat = 'wav',
    instructions,
    speed,
    language,
    abortSignal,
    headers,
  }: SpeechModelV4CallOptions): Promise<
    Awaited<ReturnType<SpeechModelV4['doGenerate']>>
  > {
    const warnings: SharedV4Warning[] = [];

    let responseFormat = outputFormat;
    if (!SUPPORTED_OUTPUT_FORMATS.includes(outputFormat)) {
      responseFormat = 'wav';
      warnings.push({
        type: 'unsupported',
        feature: 'outputFormat',
        details: `Ollama speech supports wav and pcm. Using wav instead of ${outputFormat}.`,
      });
    }
    if (speed != null && speed !== 1) {
      warnings.push({
        type: 'unsupported',
        feature: 'speed',
        details: 'Ollama speech only supports speed 1.',
      });
    }
    if (instructions != null) {
      warnings.push({ type: 'unsupported', feature: 'instructions' });
    }
    if (language != null) {
      warnings.push({
        type: 'unsupported',
        feature: 'language',
        details:
          'Ollama speech has no language setting. Pick a model and voice for the language instead.',
      });
    }

    const body: Record<string, unknown> = {
      model: this.modelId,
      input: text,
      voice,
      response_format: responseFormat,
    };

    const {
      value: audio,
      responseHeaders,
      rawValue,
    } = await postJsonToApi({
      url: `${this.config.baseURL.replace(/\/$/, '')}/v1/audio/speech`,
      headers: combineHeaders(this.config.headers(), headers),
      body,
      failedResponseHandler: ollamaSpeechFailedResponseHandler,
      successfulResponseHandler: createBinaryResponseHandler(),
      abortSignal,
      fetch: this.config.fetch,
    });

    return {
      audio,
      warnings,
      request: { body: JSON.stringify(body) },
      response: {
        timestamp: new Date(),
        modelId: this.modelId,
        headers: responseHeaders,
        body: rawValue,
      },
    };
  }
}
