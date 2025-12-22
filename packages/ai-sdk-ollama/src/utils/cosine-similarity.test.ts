import { describe, it, expect } from 'vitest';
import { cosineSimilarity } from './cosine-similarity';

describe('cosineSimilarity', () => {
  it('should return 1 for identical vectors', () => {
    const a = [1, 2, 3];
    const b = [1, 2, 3];
    expect(cosineSimilarity(a, b)).toBeCloseTo(1, 10);
  });

  it('should return -1 for opposite vectors', () => {
    const a = [1, 2, 3];
    const b = [-1, -2, -3];
    expect(cosineSimilarity(a, b)).toBeCloseTo(-1, 10);
  });

  it('should return 0 for orthogonal vectors', () => {
    const a = [1, 0];
    const b = [0, 1];
    expect(cosineSimilarity(a, b)).toBeCloseTo(0, 10);
  });

  it('should handle normalized vectors (unit length)', () => {
    const a = [1 / Math.sqrt(2), 1 / Math.sqrt(2)];
    const b = [1, 0];
    // Angle is 45 degrees, cos(45) ≈ 0.707
    expect(cosineSimilarity(a, b)).toBeCloseTo(0.7071, 3);
  });

  it('should throw error for vectors of different dimensions', () => {
    const a = [1, 2, 3];
    const b = [1, 2];
    expect(() => cosineSimilarity(a, b)).toThrow(
      'Vector dimensions must match: got 3 and 2',
    );
  });

  it('should return 0 for empty vectors', () => {
    expect(cosineSimilarity([], [])).toBe(0);
  });

  it('should return 0 when one vector is zero', () => {
    const a = [0, 0, 0];
    const b = [1, 2, 3];
    expect(cosineSimilarity(a, b)).toBe(0);
  });

  it('should handle high-dimensional vectors', () => {
    const dim = 768; // Common embedding dimension
    const a = Array.from({ length: dim }, (_, i) => Math.sin(i));
    const b = Array.from({ length: dim }, (_, i) => Math.sin(i + 0.1));
    // Should be very similar but not identical
    const similarity = cosineSimilarity(a, b);
    expect(similarity).toBeGreaterThan(0.99);
    expect(similarity).toBeLessThan(1);
  });

  it('should be commutative', () => {
    const a = [1, 2, 3, 4, 5];
    const b = [5, 4, 3, 2, 1];
    expect(cosineSimilarity(a, b)).toBe(cosineSimilarity(b, a));
  });

  it('should work with negative numbers', () => {
    const a = [-1, 2, -3];
    const b = [1, -2, 3];
    expect(cosineSimilarity(a, b)).toBeCloseTo(-1, 10);
  });
});
