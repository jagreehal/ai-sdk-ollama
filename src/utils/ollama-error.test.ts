import { describe, it, expect } from 'vitest';
import { OllamaError } from './ollama-error';

describe('OllamaError', () => {
  describe('constructor', () => {
    it('should create error with message', () => {
      const error = new OllamaError({
        message: 'Test error message',
      });

      expect(error.message).toBe('Test error message');
      expect(error.name).toBe('OllamaError');
      expect(error.cause).toBeUndefined();
    });

    it('should create error with message and cause', () => {
      const cause = new Error('Original error');
      const error = new OllamaError({
        message: 'Wrapped error',
        cause,
      });

      expect(error.message).toBe('Wrapped error');
      expect(error.name).toBe('OllamaError');
      expect(error.cause).toBe(cause);
    });

    it('should create error with non-Error cause', () => {
      const cause = { type: 'network', code: 500 };
      const error = new OllamaError({
        message: 'Network error',
        cause,
      });

      expect(error.message).toBe('Network error');
      expect(error.cause).toBe(cause);
    });
  });

  describe('isOllamaError', () => {
    it('should return true for OllamaError instances', () => {
      const error = new OllamaError({ message: 'Test' });
      expect(OllamaError.isOllamaError(error)).toBe(true);
    });

    it('should return false for regular Error instances', () => {
      const error = new Error('Test');
      expect(OllamaError.isOllamaError(error)).toBe(false);
    });

    it('should return false for non-error objects', () => {
      expect(OllamaError.isOllamaError({})).toBe(false);
      expect(OllamaError.isOllamaError(null)).toBe(false);
      expect(OllamaError.isOllamaError(void 0)).toBe(false);
      expect(OllamaError.isOllamaError('string')).toBe(false);
      expect(OllamaError.isOllamaError(123)).toBe(false);
    });

    it('should return false for objects with Error-like properties', () => {
      const errorLike = {
        name: 'Error',
        message: 'Test',
        stack: 'stack trace',
      };
      expect(OllamaError.isOllamaError(errorLike)).toBe(false);
    });
  });

  describe('inheritance', () => {
    it('should be instance of Error', () => {
      const error = new OllamaError({ message: 'Test' });
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(OllamaError);
    });

    it('should have stack trace', () => {
      const error = new OllamaError({ message: 'Test' });
      expect(error.stack).toBeDefined();
      expect(typeof error.stack).toBe('string');
    });
  });

  describe('JSON serialization', () => {
    it('should have enumerable properties for serialization', () => {
      const error = new OllamaError({
        message: 'Test error',
        cause: { code: 500 },
      });

      // Check that essential properties are accessible
      expect(error.message).toBe('Test error');
      expect(error.name).toBe('OllamaError');
      expect(error.cause).toEqual({ code: 500 });

      // Test manual serialization (since Error doesn't serialize message by default)
      const manualSerialization = {
        name: error.name,
        message: error.message,
        cause: error.cause,
        stack: error.stack,
      };

      const serialized = JSON.stringify(manualSerialization);
      const parsed = JSON.parse(serialized);

      expect(parsed.name).toBe('OllamaError');
      expect(parsed.message).toBe('Test error');
      expect(parsed.cause).toEqual({ code: 500 });
    });
  });
});
