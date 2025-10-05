import { describe, it, expect } from 'vitest';
import { enhancedRepairText, getRepairFunction } from './object-generation-reliability';

describe('Enhanced JSON Repair', () => {
  describe('enhancedRepairText', () => {
    it('should extract JSON from markdown code blocks', async () => {
      const input = '```json\n{"name": "John"}\n```';
      const result = await enhancedRepairText({
        text: input,
        error: new Error('test'),
      });
      expect(result).toBe('{"name": "John"}');
    });

    it('should remove comments', async () => {
      const input = '{\n  // this is a comment\n  "name": "John"\n}';
      const result = await enhancedRepairText({
        text: input,
        error: new Error('test'),
      });
      expect(result).not.toContain('//');
      expect(JSON.parse(result!)).toEqual({ name: 'John' });
    });

    it('should fix smart quotes', async () => {
      const input = '{"name": "John"}'; // curly quotes
      const result = await enhancedRepairText({
        text: input,
        error: new Error('test'),
      });
      expect(JSON.parse(result!)).toEqual({ name: 'John' });
    });

    it('should fix unquoted keys', async () => {
      const input = '{name: "John", age: 30}';
      const result = await enhancedRepairText({
        text: input,
        error: new Error('test'),
      });
      expect(JSON.parse(result!)).toEqual({ name: 'John', age: 30 });
    });

    it('should remove trailing commas', async () => {
      const input = '{"name": "John", "age": 30,}';
      const result = await enhancedRepairText({
        text: input,
        error: new Error('test'),
      });
      expect(JSON.parse(result!)).toEqual({ name: 'John', age: 30 });
    });

    it('should fix incomplete objects', async () => {
      const input = '{"name": "John", "age": 30';
      const result = await enhancedRepairText({
        text: input,
        error: new Error('test'),
      });
      expect(JSON.parse(result!)).toEqual({ name: 'John', age: 30 });
    });

    it('should fix incomplete arrays', async () => {
      const input = '[1, 2, 3';
      const result = await enhancedRepairText({
        text: input,
        error: new Error('test'),
      });
      expect(JSON.parse(result!)).toEqual([1, 2, 3]);
    });

    it('should handle ellipsis patterns', async () => {
      const input = '{"items": [1, 2, ..., 5]}';
      const result = await enhancedRepairText({
        text: input,
        error: new Error('test'),
      });
      const parsed = JSON.parse(result!);
      expect(Array.isArray(parsed.items)).toBe(true);
    });

    it('should fix single quotes', async () => {
      const input = "{'name': 'John', 'age': 30}";
      const result = await enhancedRepairText({
        text: input,
        error: new Error('test'),
      });
      expect(JSON.parse(result!)).toEqual({ name: 'John', age: 30 });
    });

    it('should handle complex nested objects', async () => {
      const input = `{
        name: 'John',
        address: {
          city: 'New York',
          zip: 10001,
        }
      }`;
      const result = await enhancedRepairText({
        text: input,
        error: new Error('test'),
      });
      expect(JSON.parse(result!)).toEqual({
        name: 'John',
        address: {
          city: 'New York',
          zip: 10_001,
        },
      });
    });

    it('should fix Python constants', async () => {
      const input = '{name: "John", active: True, value: None, disabled: False}';
      const result = await enhancedRepairText({
        text: input,
        error: new Error('test'),
      });
      expect(JSON.parse(result!)).toEqual({
        name: 'John',
        active: true,
        value: null,
        disabled: false,
      });
    });

    it('should remove JSONP wrapper', async () => {
      const input = 'callback({"name": "John"})';
      const result = await enhancedRepairText({
        text: input,
        error: new Error('test'),
      });
      expect(JSON.parse(result!)).toEqual({ name: 'John' });
    });

    it('should return null for completely invalid JSON', async () => {
      const input = 'this is not json at all';
      const result = await enhancedRepairText({
        text: input,
        error: new Error('test'),
      });
      expect(result).toBeNull();
    });
  });

  describe('getRepairFunction', () => {
    it('should return custom repair function if provided', () => {
      const customRepair = async () => null;
      const result = getRepairFunction({ repairText: customRepair });
      expect(result).toBe(customRepair);
    });

    it('should return undefined if text repair is disabled', () => {
      const result = getRepairFunction({ enableTextRepair: false });
      expect(result).toBeUndefined();
    });

    it('should return enhanced repair by default', () => {
      const result = getRepairFunction({});
      expect(result).toBe(enhancedRepairText);
    });
  });
});
