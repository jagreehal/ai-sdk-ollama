import { EmbeddingModelV2, EmbeddingModelV2Embedding } from '@ai-sdk/provider';
import { Ollama, type EmbedResponse } from 'ollama';
import { OllamaEmbeddingSettings } from '../provider';
import { OllamaError } from '../utils/ollama-error';

export interface OllamaEmbeddingConfig {
  client: Ollama;
  provider: string;
}

export class OllamaEmbeddingModel implements EmbeddingModelV2<string> {
  readonly specificationVersion = 'v2' as const;
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
  }): Promise<{
    embeddings: EmbeddingModelV2Embedding[];
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
      const embeddings: EmbeddingModelV2Embedding[] = [];

      // Ollama's embed API currently only supports single prompts
      // So we need to make multiple requests
      for (const value of values) {
        // Skip undefined values (AI SDK interface issue workaround)
        if (value === undefined || value === null) {
          continue;
        }

        const response: EmbedResponse = await this.config.client.embed({
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
