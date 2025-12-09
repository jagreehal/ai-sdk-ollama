import {
  EmbeddingModelV3,
  EmbeddingModelV3Embedding,
  SharedV2ProviderMetadata,
  SharedV3ProviderOptions,
} from '@ai-sdk/provider';
import { Ollama } from 'ollama';
import { OllamaEmbeddingSettings } from '../provider';
import { OllamaError } from '../utils/ollama-error';

export interface OllamaEmbeddingConfig {
  client: Ollama;
  provider: string;
}

export class OllamaEmbeddingModel implements EmbeddingModelV3 {
  readonly specificationVersion = 'v3' as const;
  readonly modelId: string;
  readonly maxEmbeddingsPerCall = 2048;
  readonly supportsParallelCalls = true;

  constructor(
    modelId: string,
    private readonly settings: OllamaEmbeddingSettings,
    private readonly config: OllamaEmbeddingConfig,
  ) {
    this.modelId = modelId;
  }

  get provider(): string {
    return this.config.provider;
  }

  async doEmbed(params: {
    values: string[];
    abortSignal?: AbortSignal;
    providerOptions?: SharedV3ProviderOptions;
    headers?: Record<string, string | undefined>;
  }): Promise<{
    embeddings: EmbeddingModelV3Embedding[];
    usage?: { tokens: number };
    providerMetadata?: SharedV2ProviderMetadata;
    response?: { headers?: Record<string, string>; body?: unknown };
  }> {
    const { values, abortSignal } = params;
    if (values.length > this.maxEmbeddingsPerCall) {
      throw new OllamaError({
        message: `Too many values to embed. Maximum: ${this.maxEmbeddingsPerCall}, Received: ${values.length}`,
      });
    }

    // Handle empty array case
    if (values.length === 0) {
      return { embeddings: [] };
    }

    try {
      const embeddings: EmbeddingModelV3Embedding[] = [];
      let totalTokens = 0;

      // Ollama's embed API currently only supports single prompts
      // So we need to make multiple requests
      for (const value of values) {
        // Skip undefined values (AI SDK interface issue workaround)
        if (value === undefined || value === null) {
          continue;
        }

        const response = await this.config.client.embed({
          model: this.modelId,
          input: value,
          options: this.settings.options,
          ...(this.settings.dimensions !== undefined && {
            dimensions: this.settings.dimensions,
          }),
        });

        if (!response.embeddings) {
          throw new OllamaError({
            message: `No embeddings field in response`,
          });
        }

        if (response.embeddings.length === 0) {
          throw new OllamaError({
            message: `Empty embeddings array returned`,
          });
        }

        embeddings.push(response.embeddings[0] as number[]);

        // Track token usage if available (Ollama may not always provide this)
        // Note: Ollama's embed response doesn't currently include token counts
        // but we track it for future compatibility
        if ((response as { prompt_eval_count?: number }).prompt_eval_count) {
          totalTokens += (response as { prompt_eval_count: number })
            .prompt_eval_count;
        }

        // Check if we should abort
        if (abortSignal?.aborted) {
          throw new Error('Embedding generation aborted');
        }
      }

      if (embeddings.length === 0) {
        throw new OllamaError({
          message: `No valid values provided for embedding (all were undefined/null)`,
        });
      }

      return {
        embeddings,
        usage: totalTokens > 0 ? { tokens: totalTokens } : undefined,
        providerMetadata: {
          ollama: {
            model: this.modelId,
          },
        },
      };
    } catch (error) {
      if (error instanceof OllamaError) {
        throw error;
      }

      throw new OllamaError({
        message: error instanceof Error ? error.message : String(error),
        cause: error,
      });
    }
  }
}
