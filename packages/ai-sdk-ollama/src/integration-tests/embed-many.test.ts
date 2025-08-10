import { describe, it, expect } from 'vitest';
import { embedMany, cosineSimilarity } from 'ai';
import { ollama } from '../index';

describe(
  'Embed Many and Cosine Similarity Integration Tests',
  { timeout: 120_000 },
  () => {
    it('should embed multiple texts and return embeddings', async () => {
      const result = await embedMany({
        model: ollama.embedding('nomic-embed-text'),
        values: [
          'sunny day at the beach',
          'warm sand and ocean waves',
          'rainy evening in the city',
        ],
      });

      expect(result.embeddings).toBeDefined();
      expect(result.embeddings).toHaveLength(3);
      expect(result.embeddings[0]).toBeInstanceOf(Array);
      expect(result.embeddings[0]?.length).toBeGreaterThan(0);
      expect(typeof result.embeddings[0]?.[0]).toBe('number');
    });

    it('should calculate cosine similarity between embeddings', async () => {
      const { embeddings } = await embedMany({
        model: ollama.embedding('nomic-embed-text'),
        values: [
          'sunny day at the beach',
          'warm sand and ocean waves',
          'cold winter night with snow',
        ],
      });

      // Similar texts should have higher cosine similarity
      const similarityBeachWaves = cosineSimilarity(
        embeddings[0]!,
        embeddings[1]!,
      );
      const similarityBeachWinter = cosineSimilarity(
        embeddings[0]!,
        embeddings[2]!,
      );

      expect(typeof similarityBeachWaves).toBe('number');
      expect(similarityBeachWaves).toBeGreaterThanOrEqual(-1);
      expect(similarityBeachWaves).toBeLessThanOrEqual(1);

      // Beach and waves should be more similar than beach and winter
      expect(similarityBeachWaves).toBeGreaterThan(similarityBeachWinter);
    });

    it('should handle empty values array', async () => {
      const result = await embedMany({
        model: ollama.embedding('nomic-embed-text'),
        values: [],
      });

      expect(result.embeddings).toBeDefined();
      expect(result.embeddings).toHaveLength(0);
    });
  },
);
