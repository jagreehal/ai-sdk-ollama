import {
  RerankingModelV3,
  RerankingModelV3CallOptions,
  SharedV3Warning,
} from '@ai-sdk/provider';
import {
  combineHeaders,
  createJsonResponseHandler,
  createJsonErrorResponseHandler,
  FetchFunction,
  postJsonToApi,
} from '@ai-sdk/provider-utils';
import { z } from 'zod';

/**
 * Ollama reranking API request format
 * Based on https://github.com/ollama/ollama/pull/11389
 */
interface OllamaRerankRequest {
  model: string;
  query: string;
  documents: string[];
  instruction?: string;
  top_n?: number;
}

/**
 * Ollama reranking API response schema
 */
const ollamaRerankingResponseSchema = z.object({
  model: z.string(),
  results: z.array(
    z.object({
      index: z.number(),
      document: z.string(),
      relevance_score: z.number(),
    }),
  ),
});

/**
 * Configuration for the Ollama reranking model
 */
export interface OllamaRerankingConfig {
  provider: string;
  baseURL: string;
  headers: () => Record<string, string | undefined>;
  fetch?: FetchFunction;
}

/**
 * Settings for configuring Ollama reranking models
 */
export interface OllamaRerankingSettings {
  /**
   * Custom instruction for the reranker model.
   * Defaults to the model's built-in instruction (usually "Please judge relevance").
   */
  instruction?: string;
}

/**
 * Ollama provider options for reranking calls
 */
export interface OllamaRerankingProviderOptions {
  /**
   * Custom instruction for this specific reranking call.
   * Overrides the instruction set in model settings.
   */
  instruction?: string;
}

/**
 * Schema for validating Ollama reranking provider options
 */
const ollamaRerankingProviderOptionsSchema = z.object({
  instruction: z.string().optional(),
});

/**
 * Ollama error response schema
 */
const ollamaErrorSchema = z.object({
  error: z.string().optional(),
  message: z.string().optional(),
});

/**
 * Failed response handler for Ollama API errors
 */
const ollamaFailedResponseHandler = createJsonErrorResponseHandler({
  errorSchema: ollamaErrorSchema,
  errorToMessage: (data) => data.error ?? data.message ?? 'Unknown error',
});

/**
 * Native Ollama Reranking Model
 *
 * **WAITING FOR OFFICIAL SUPPORT**
 *
 * This implementation uses Ollama's /api/rerank endpoint from PR #11389.
 * As of December 2024, this PR has NOT been merged into Ollama.
 *
 * **For a working solution, use `OllamaEmbeddingRerankingModel` instead:**
 * ```ts
 * import { ollama } from 'ai-sdk-ollama';
 * import { rerank } from 'ai';
 *
 * const result = await rerank({
 *   model: ollama.embeddingReranking('bge-m3'),
 *   query: 'What is machine learning?',
 *   documents: [...],
 * });
 * ```
 *
 * This native implementation will work once Ollama adds reranking support:
 * @see https://github.com/ollama/ollama/pull/11389
 *
 * @example
 * ```ts
 * // NOT YET WORKING - requires Ollama reranking API
 * import { ollama } from 'ai-sdk-ollama';
 * import { rerank } from 'ai';
 *
 * const { rerankedDocuments } = await rerank({
 *   model: ollama.rerankingModel('bge-reranker-v2-m3'),
 *   query: 'What is machine learning?',
 *   documents: [
 *     'Machine learning is a subset of AI...',
 *     'The weather today is sunny...',
 *     'Deep learning uses neural networks...',
 *   ],
 *   topN: 2,
 * });
 * ```
 */
export class OllamaRerankingModel implements RerankingModelV3 {
  readonly specificationVersion = 'v3' as const;
  readonly modelId: string;

  private readonly config: OllamaRerankingConfig;
  private readonly settings: OllamaRerankingSettings;

  constructor(
    modelId: string,
    settings: OllamaRerankingSettings,
    config: OllamaRerankingConfig,
  ) {
    this.modelId = modelId;
    this.settings = settings;
    this.config = config;
  }

  get provider(): string {
    return this.config.provider;
  }

  async doRerank({
    documents,
    headers,
    query,
    topN,
    abortSignal,
    providerOptions,
  }: RerankingModelV3CallOptions): Promise<
    Awaited<ReturnType<RerankingModelV3['doRerank']>>
  > {
    const warnings: SharedV3Warning[] = [];

    // Parse provider options
    let rerankingOptions: OllamaRerankingProviderOptions | undefined;
    if (providerOptions?.ollama) {
      const parsed = ollamaRerankingProviderOptionsSchema.safeParse(
        providerOptions.ollama,
      );
      if (parsed.success) {
        rerankingOptions = parsed.data;
      }
    }

    // Handle object documents by converting to strings with a warning
    let documentValues: string[];
    if (documents.type === 'object') {
      warnings.push({
        type: 'compatibility',
        feature: 'object documents',
        details:
          'Object documents are converted to JSON strings for reranking.',
      });
      documentValues = documents.values.map((value) => JSON.stringify(value));
    } else {
      documentValues = documents.values;
    }

    // Build request body
    const requestBody: OllamaRerankRequest = {
      model: this.modelId,
      query,
      documents: documentValues,
    };

    // Add optional parameters
    const instruction =
      rerankingOptions?.instruction ?? this.settings.instruction;
    if (instruction) {
      requestBody.instruction = instruction;
    }

    if (topN !== undefined) {
      requestBody.top_n = topN;
    }

    // Make API request
    const {
      responseHeaders,
      value: response,
      rawValue,
    } = await postJsonToApi({
      url: `${this.config.baseURL}/api/rerank`,
      headers: combineHeaders(this.config.headers(), headers),
      body: requestBody,
      failedResponseHandler: ollamaFailedResponseHandler,
      successfulResponseHandler: createJsonResponseHandler(
        ollamaRerankingResponseSchema,
      ),
      abortSignal,
      fetch: this.config.fetch,
    });

    return {
      ranking: response.results.map(
        (result: { index: number; relevance_score: number }) => ({
          index: result.index,
          relevanceScore: result.relevance_score,
        }),
      ),
      warnings: warnings.length > 0 ? warnings : undefined,
      response: {
        modelId: response.model,
        headers: responseHeaders,
        body: rawValue,
      },
    };
  }
}
