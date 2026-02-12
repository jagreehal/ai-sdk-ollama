import { describe, it, expect, vi } from 'vitest';
import { parseToolArguments } from './tool-calling-reliability';

describe('parseToolArguments', () => {
  describe('valid JSON', () => {
    it('parses valid JSON string and returns object', () => {
      const result = parseToolArguments('{"name": "John", "age": 30}');
      expect(result).toEqual({ name: 'John', age: 30 });
    });

    it('parses empty object string', () => {
      const result = parseToolArguments('{}');
      expect(result).toEqual({});
    });

    it('parses nested object', () => {
      const result = parseToolArguments(
        '{"user": {"name": "Alice", "active": true}}',
      );
      expect(result).toEqual({ user: { name: 'Alice', active: true } });
    });
  });

  describe('malformed JSON repaired by jsonrepair', () => {
    it('repairs trailing comma and returns object', () => {
      const result = parseToolArguments('{"name": "John", "age": 30,}');
      expect(result).toEqual({ name: 'John', age: 30 });
    });

    it('repairs unquoted keys and returns object', () => {
      const result = parseToolArguments('{name: "John", age: 30}');
      expect(result).toEqual({ name: 'John', age: 30 });
    });

    it('repairs single quotes to double quotes', () => {
      const result = parseToolArguments("{'key': 'value'}");
      expect(result).toEqual({ key: 'value' });
    });

    it('parses quoted JSON object strings', () => {
      const result = parseToolArguments(
        String.raw`"{\"query\":\"weather\",\"limit\":5}"`,
      );
      expect(result).toEqual({ query: 'weather', limit: 5 });
    });
  });

  describe('non-string input', () => {
    it('returns object when input is already an object', () => {
      const input = { location: 'NYC', units: 'celsius' };
      const result = parseToolArguments(input);
      expect(result).toEqual(input);
    });

    it('returns empty object when input is array', () => {
      const result = parseToolArguments([1, 2, 3]);
      expect(result).toEqual({});
    });

    it('returns empty object when input is null', () => {
      const result = parseToolArguments(null);
      expect(result).toEqual({});
    });

    it('returns empty object when input is undefined', () => {
      const result = parseToolArguments();
      expect(result).toEqual({});
    });

    it('returns empty object when input is empty string', () => {
      const result = parseToolArguments('');
      expect(result).toEqual({});
    });
  });

  describe('unrepairable JSON', () => {
    it('returns empty object when JSON is completely invalid', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const result = parseToolArguments('not json at all {{{');
      expect(result).toEqual({});
      consoleSpy.mockRestore();
    });
  });
});
