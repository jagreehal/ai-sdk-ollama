import { describe, it, expect } from 'vitest';
import { mapOllamaFinishReason } from './map-ollama-finish-reason';

describe('mapOllamaFinishReason', () => {
  describe('valid reasons', () => {
    it('should map "stop" to V3 format with unified "stop"', () => {
      const result = mapOllamaFinishReason('stop');
      expect(result).toEqual({ unified: 'stop', raw: 'stop' });
    });

    it('should map "length" to V3 format with unified "length"', () => {
      const result = mapOllamaFinishReason('length');
      expect(result).toEqual({ unified: 'length', raw: 'length' });
    });
  });

  describe('invalid/unknown reasons', () => {
    it('should map unknown string to V3 format with unified "other"', () => {
      expect(mapOllamaFinishReason('unknown_reason')).toEqual({
        unified: 'other',
        raw: 'unknown_reason',
      });
      expect(mapOllamaFinishReason('error')).toEqual({
        unified: 'other',
        raw: 'error',
      });
      expect(mapOllamaFinishReason('timeout')).toEqual({
        unified: 'other',
        raw: 'timeout',
      });
      expect(mapOllamaFinishReason('cancelled')).toEqual({
        unified: 'other',
        raw: 'cancelled',
      });
    });

    it('should handle null as unified "stop" (normal completion)', () => {
      const result = mapOllamaFinishReason(null);
      expect(result).toEqual({ unified: 'stop', raw: undefined });
    });

    it('should handle undefined as unified "stop" (normal completion)', () => {
      const result = mapOllamaFinishReason();
      expect(result).toEqual({ unified: 'stop', raw: undefined });
    });

    it('should handle empty string as unified "stop" (normal completion)', () => {
      const result = mapOllamaFinishReason('');
      expect(result).toEqual({ unified: 'stop', raw: undefined });
    });
  });

  describe('case sensitivity', () => {
    it('should be case sensitive for valid reasons', () => {
      expect(mapOllamaFinishReason('STOP')).toEqual({
        unified: 'other',
        raw: 'STOP',
      });
      expect(mapOllamaFinishReason('Stop')).toEqual({
        unified: 'other',
        raw: 'Stop',
      });
      expect(mapOllamaFinishReason('LENGTH')).toEqual({
        unified: 'other',
        raw: 'LENGTH',
      });
      expect(mapOllamaFinishReason('Length')).toEqual({
        unified: 'other',
        raw: 'Length',
      });
    });
  });

  describe('edge cases', () => {
    it('should handle whitespace as unknown', () => {
      expect(mapOllamaFinishReason(' stop ')).toEqual({
        unified: 'other',
        raw: ' stop ',
      });
      expect(mapOllamaFinishReason('\tstop\n')).toEqual({
        unified: 'other',
        raw: '\tstop\n',
      });
    });

    it('should handle special characters as unknown', () => {
      expect(mapOllamaFinishReason('stop!')).toEqual({
        unified: 'other',
        raw: 'stop!',
      });
      expect(mapOllamaFinishReason('stop-reason')).toEqual({
        unified: 'other',
        raw: 'stop-reason',
      });
    });
  });
});
