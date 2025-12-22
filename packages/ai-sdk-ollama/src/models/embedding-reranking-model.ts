import {
  RerankingModelV3,
  RerankingModelV3CallOptions,
  SharedV3Warning,
} from '@ai-sdk/provider';
import { Ollama } from 'ollama';
import { cosineSimilarity } from '../utils/cosine-similarity';

/**
 * Configuration for the Ollama embedding-based reranking model
 */
export interface OllamaEmbeddingRerankingConfig {
  client: Ollama;
  provider: string;
}

/**
 * Settings for configuring Ollama embedding-based reranking
 */
export interface OllamaEmbeddingRerankingSettings {
  /**
   * Embedding model to use for computing document similarity.
   * If not specified, uses the modelId passed to the constructor.
   * Recommended models: 'bge-m3', 'nomic-embed-text', 'mxbai-embed-large'
   */
  embeddingModel?: string;
  /**
   * Maximum number of texts to embed per request. Smaller batches reduce
   * memory/latency spikes for large document sets while still avoiding one
   * request per document. Defaults to 16.
   */
  maxBatchSize?: number;
}

/**
 * Embedding-Based Reranking Model (Workaround)
 *
 * Since Ollama doesn't have native reranking support yet (PR #11389 not merged),
 * this implementation uses embedding similarity as a workaround:
 *
 * 1. Embed the query using an embedding model
 * 2. Embed all documents using the same model
 * 3. Calculate cosine similarity between query and each document
 * 4. Sort documents by similarity score (descending)
 *
 * This approach works with any Ollama embedding model and provides
 * reasonable reranking results for most use cases.
 *
 * @example
 * ```ts
 * import { ollama } from 'ai-sdk-ollama';
 * import { rerank } from 'ai';
 *
 * const result = await rerank({
 *   model: ollama.embeddingReranking('bge-m3'),
 *   query: 'What is machine learning?',
 *   documents: [
 *     'Machine learning is a subset of AI...',
 *     'The weather today is sunny...',
 *     'Deep learning uses neural networks...',
 *   ],
 *   topN: 2,
 * });
 *
 * console.log(result.rerankedDocuments);
 * // Documents sorted by relevance to the query
 * ```
 */
export class OllamaEmbeddingRerankingModel implements RerankingModelV3 {
  readonly specificationVersion = 'v3' as const;
  readonly modelId: string;

  private readonly config: OllamaEmbeddingRerankingConfig;
  private readonly settings: OllamaEmbeddingRerankingSettings;

  constructor(
    modelId: string,
    settings: OllamaEmbeddingRerankingSettings,
    config: OllamaEmbeddingRerankingConfig,
  ) {
    this.modelId = modelId;
    this.settings = settings;
    this.config = config;
  }

  get provider(): string {
    return this.config.provider;
  }

  /**
   * Get the effective embedding model to use
   */
  private get embeddingModelId(): string {
    return this.settings.embeddingModel ?? this.modelId;
  }

  /**
   * Normalized batch size for embedding requests. Ensures we never request
   * non-positive batch sizes.
   */
  private get embeddingBatchSize(): number {
    const { maxBatchSize } = this.settings;

    if (
      typeof maxBatchSize === 'number' &&
      Number.isFinite(maxBatchSize) &&
      maxBatchSize > 0
    ) {
      return Math.floor(maxBatchSize);
    }

    return 16;
  }

  /**
   * Embed a batch of texts while keeping their order aligned with the
   * embeddings that are returned.
   */
  private async embedBatch(texts: string[]): Promise<number[][]> {
    const model = this.embeddingModelId;
    const batchSize = this.embeddingBatchSize;
    const embeddings: number[][] = [];

    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);
      const response = await this.config.client.embed({
        model,
        input: batch,
      });

      if (response.embeddings.length !== batch.length) {
        throw new Error(
          `Embedding response mismatch: expected ${batch.length} got ${response.embeddings.length}`,
        );
      }

      embeddings.push(...response.embeddings);
    }

    if (embeddings.length !== texts.length) {
      throw new Error(
        `Embedding batch returned ${embeddings.length} vectors for ${texts.length} inputs`,
      );
    }

    return embeddings;
  }

  async doRerank({
    documents,
    query,
    topN,
  }: RerankingModelV3CallOptions): Promise<
    Awaited<ReturnType<RerankingModelV3['doRerank']>>
  > {
    const warnings: SharedV3Warning[] = [];

    // Convert documents to strings
    let documentValues: string[];
    if (documents.type === 'object') {
      warnings.push({
        type: 'compatibility',
        feature: 'object documents',
        details: 'Object documents are converted to JSON strings for embedding.',
      });
      documentValues = documents.values.map((v) => JSON.stringify(v));
    } else {
      documentValues = documents.values;
    }

    // Handle empty documents
    if (documentValues.length === 0) {
      return {
        ranking: [],
        warnings: warnings.length > 0 ? warnings : undefined,
        response: {
          modelId: this.embeddingModelId,
        },
      };
    }

    const [queryEmbedding, ...docEmbeddings] = await this.embedBatch([
      query,
      ...documentValues,
    ]);

    if (!queryEmbedding) {
      throw new Error('Query embedding was not returned.');
    }

    // Calculate similarity scores
    const scores = docEmbeddings.map((docEmb, index) => ({
      index,
      relevanceScore: cosineSimilarity(queryEmbedding, docEmb),
    }));

    // Sort by score (descending) and limit to topN
    // Using spread + sort instead of toSorted for ES2020 compatibility
    const maxResults = Math.min(topN ?? documentValues.length, documentValues.length);

    const ranking = [...scores]
      // eslint-disable-next-line unicorn/no-array-sort -- toSorted requires ES2023, browser target is ES2020
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, maxResults);

    return {
      ranking,
      warnings: warnings.length > 0 ? warnings : undefined,
      response: {
        modelId: this.embeddingModelId,
      },
    };
  }
}
