import type {
  ImageModelV3,
  ImageModelV3CallOptions,
  ImageModelV3ProviderMetadata,
  ImageModelV3Usage,
} from '@ai-sdk/provider';
import type { SharedV3Warning } from '@ai-sdk/provider';
import { parseProviderOptions } from '@ai-sdk/provider-utils';
import { z } from 'zod';
import { OllamaError } from '../utils/ollama-error';

const ollamaImageProviderOptionsSchema = z.object({
  steps: z.number().optional(),
  negative_prompt: z.string().optional(),
});

export interface OllamaImageModelConfig {
  provider: string;
  modelId: string;
  baseURL: string;
  headers: () => Record<string, string>;
  fetch?: typeof globalThis.fetch;
}

/**
 * Ollama image generation model (ImageModelV3).
 * Uses POST /api/generate with image models (e.g. x/z-image-turbo, x/flux2-klein).
 * Experimental; see https://ollama.com/blog/image-generation
 */
export class OllamaImageModel implements ImageModelV3 {
  readonly specificationVersion = 'v3' as const;
  readonly provider: string;
  readonly modelId: string;
  readonly maxImagesPerCall = 1;

  constructor(
    modelId: string,
    private readonly config: OllamaImageModelConfig,
  ) {
    this.modelId = modelId;
    this.provider = config.provider;
  }

  async doGenerate(options: ImageModelV3CallOptions): Promise<{
    images: Array<string>;
    warnings: Array<SharedV3Warning>;
    response: {
      timestamp: Date;
      modelId: string;
      headers: Record<string, string> | undefined;
    };
    usage?: ImageModelV3Usage;
    providerMetadata?: ImageModelV3ProviderMetadata;
  }> {
    const {
      prompt,
      size,
      aspectRatio,
      seed,
      providerOptions,
      abortSignal,
      headers: optHeaders,
    } = options;

    if (prompt == null || prompt === '') {
      throw new OllamaError({ message: 'Image generation requires a prompt' });
    }

    const url = `${this.config.baseURL.replace(/\/$/, '')}/api/generate`;
    const body: Record<string, unknown> = {
      model: this.modelId,
      prompt,
      stream: false,
    };

    // Map size "WxH" to width/height (Ollama experimental params)
    if (size) {
      const [w, h] = size.split('x').map(Number);
      if (!Number.isNaN(w)) body.width = w;
      if (!Number.isNaN(h)) body.height = h;
    }
    // Map aspectRatio "W:H" to width/height at ~1024² pixel area (only when size not already set)
    if (aspectRatio && body.width == null && body.height == null) {
      const [ratioW, ratioH] = aspectRatio.split(':').map(Number);
      if (
        ratioW != null &&
        ratioH != null &&
        !Number.isNaN(ratioW) &&
        !Number.isNaN(ratioH) &&
        ratioW > 0 &&
        ratioH > 0
      ) {
        const target = 1024;
        body.width = Math.round(target * Math.sqrt(ratioW / ratioH));
        body.height = Math.round(target * Math.sqrt(ratioH / ratioW));
      }
    }
    if (seed != null) {
      const opts = (
        typeof body.options === 'object' && body.options ? body.options : {}
      ) as Record<string, unknown>;
      body.options = { ...opts, seed };
    }
    const po = await parseProviderOptions({
      provider: 'ollama',
      providerOptions,
      schema: ollamaImageProviderOptionsSchema,
    });
    if (po?.steps != null) body.steps = po.steps;
    if (po?.negative_prompt != null) body.negative_prompt = po.negative_prompt;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...this.config.headers(),
      ...optHeaders,
    };

    const res = await (this.config.fetch ?? fetch)(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: abortSignal,
    });

    if (!res.ok) {
      const errBody = (await res.json().catch(() => ({}))) as {
        error?: string;
      };
      throw new OllamaError({
        message:
          errBody.error ?? `Ollama API error: ${res.status} ${res.statusText}`,
      });
    }

    const data = (await res.json()) as {
      model?: string;
      response?: string;
      images?: string[];
      image?: string;
      total_duration?: number;
      eval_count?: number;
    };

    const images: string[] = [];
    if (Array.isArray(data.images) && data.images.length > 0) {
      images.push(...data.images);
    } else if (typeof data.image === 'string' && data.image.trim().length > 0) {
      images.push(data.image.trim());
    } else if (
      typeof data.response === 'string' &&
      data.response.trim().length > 0
    ) {
      const trimmed = data.response.trim();
      if (/^[A-Za-z0-9+/=]+$/.test(trimmed) && trimmed.length > 100) {
        images.push(trimmed);
      }
    }

    const responseHeaders: Record<string, string> = {};
    for (const [key, value] of res.headers.entries()) {
      responseHeaders[key] = value;
    }

    return {
      images,
      warnings: [],
      response: {
        timestamp: new Date(),
        modelId: data.model ?? this.modelId,
        headers:
          Object.keys(responseHeaders).length > 0 ? responseHeaders : undefined,
      },
      usage:
        data.eval_count == null
          ? undefined
          : {
              inputTokens: undefined,
              outputTokens: data.eval_count,
              totalTokens: data.eval_count,
            },
    };
  }
}
