/**
 * Calculate cosine similarity between two vectors.
 *
 * Cosine similarity measures the angle between two vectors in multi-dimensional space,
 * returning a value between -1 and 1 where:
 * - 1 means identical direction (most similar)
 * - 0 means orthogonal (unrelated)
 * - -1 means opposite direction (least similar)
 *
 * For normalized embedding vectors, this is equivalent to the dot product.
 *
 * @param a First vector
 * @param b Second vector
 * @returns Cosine similarity score between -1 and 1
 * @throws Error if vectors have different dimensions
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error(
      `Vector dimensions must match: got ${a.length} and ${b.length}`,
    );
  }

  if (a.length === 0) {
    return 0;
  }

  let dotProduct = 0;
  let magnitudeA = 0;
  let magnitudeB = 0;

  for (const [i, aVal] of a.entries()) {
    const bVal = b[i]!;
    dotProduct += aVal * bVal;
    magnitudeA += aVal * aVal;
    magnitudeB += bVal * bVal;
  }

  magnitudeA = Math.sqrt(magnitudeA);
  magnitudeB = Math.sqrt(magnitudeB);

  // Handle zero magnitude vectors
  if (magnitudeA === 0 || magnitudeB === 0) {
    return 0;
  }

  return dotProduct / (magnitudeA * magnitudeB);
}
