import { describe, it, expect } from 'vitest';
import { mapOllamaFinishReason } from './map-ollama-finish-reason';

describe('mapOllamaFinishReason', () => {
  describe('valid reasons', () => {
    it('should map "stop" to "stop"', () => {
      expect(mapOllamaFinishReason('stop')).toBe('stop');
    });

    it('should map "length" to "length"', () => {
      expect(mapOllamaFinishReason('length')).toBe('length');
    });
  });

  describe('invalid/unknown reasons', () => {
    it('should map unknown string to "unknown"', () => {
      expect(mapOllamaFinishReason('unknown_reason')).toBe('unknown');
      expect(mapOllamaFinishReason('error')).toBe('unknown');
      expect(mapOllamaFinishReason('timeout')).toBe('unknown');
      expect(mapOllamaFinishReason('cancelled')).toBe('unknown');
    });

    it('should handle null as "unknown"', () => {
      expect(mapOllamaFinishReason(null)).toBe('unknown');
    });

    it('should handle undefined as "unknown"', () => {
      expect(mapOllamaFinishReason()).toBe('unknown');
    });

    it('should handle empty string as "unknown"', () => {
      expect(mapOllamaFinishReason('')).toBe('unknown');
    });
  });

  describe('case sensitivity', () => {
    it('should be case sensitive for valid reasons', () => {
      expect(mapOllamaFinishReason('STOP')).toBe('unknown');
      expect(mapOllamaFinishReason('Stop')).toBe('unknown');
      expect(mapOllamaFinishReason('LENGTH')).toBe('unknown');
      expect(mapOllamaFinishReason('Length')).toBe('unknown');
    });
  });

  describe('edge cases', () => {
    it('should handle whitespace', () => {
      expect(mapOllamaFinishReason(' stop ')).toBe('unknown');
      expect(mapOllamaFinishReason('\tstop\n')).toBe('unknown');
    });

    it('should handle special characters', () => {
      expect(mapOllamaFinishReason('stop!')).toBe('unknown');
      expect(mapOllamaFinishReason('stop-reason')).toBe('unknown');
    });
  });
});
