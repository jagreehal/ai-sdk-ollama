import { describe, it, expect } from 'vitest';
import {
  enhancedRepairText,
  getRepairFunction,
  parseJSONWithRepair,
} from './object-generation-reliability';

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
      // Use actual Unicode curly quotes (U+201C and U+201D)
      const input = '{\u201Cname\u201D: \u201CJohn\u201D}'; // curly quotes
      const result = await enhancedRepairText({
        text: input,
        error: new Error('test'),
      });
      expect(JSON.parse(result!)).toEqual({ name: 'John' });
    });

    it('should handle multiple smart-quoted fields', async () => {
      const input =
        '{\u201Cfirst\u201D: \u201Cone\u201D, \u201Csecond\u201D: \u201Ctwo\u201D}';
      const result = await enhancedRepairText({
        text: input,
        error: new Error('test'),
      });
      expect(JSON.parse(result!)).toEqual({ first: 'one', second: 'two' });
    });

    it('should close smart-quoted values before unquoted keys', async () => {
      const input = '{\u201Cfirst\u201D: \u201Cone\u201D, second: 2}';
      const result = await enhancedRepairText({
        text: input,
        error: new Error('test'),
      });
      expect(JSON.parse(result!)).toEqual({ first: 'one', second: 2 });
    });

    it('should close smart-quoted values before numeric keys', async () => {
      const input = '{\u201Cfirst\u201D: \u201Cone\u201D, 2: "two"}';
      const result = await enhancedRepairText({
        text: input,
        error: new Error('test'),
      });
      expect(JSON.parse(result!)).toEqual({ first: 'one', 2: 'two' });
    });

    it('should close smart-quoted keys before Python constants', async () => {
      const input = '{\u201Cflag\u201D: True}';
      const result = await enhancedRepairText({
        text: input,
        error: new Error('test'),
      });
      expect(JSON.parse(result!)).toEqual({ flag: true });
    });

    it('should preserve numeric text inside smart-quoted string values', async () => {
      const input = '{\u201Cnote\u201D: \u201CValue 123.45\u201D}';
      const result = await enhancedRepairText({
        text: input,
        error: new Error('test'),
      });
      expect(JSON.parse(result!)).toEqual({ note: 'Value 123.45' });
    });

    it('should preserve smart quotes inside string values', async () => {
      const input = '{"quote": "He said \u201CHi\u201D"}';
      const result = await enhancedRepairText({
        text: input,
        error: new Error('test'),
      });
      expect(JSON.parse(result!)).toEqual({
        quote: 'He said \u201CHi\u201D',
      });
    });

    it('should preserve Python-looking words inside smart-quoted strings', async () => {
      const input = '{\u201Cstatus\u201D: \u201CTrue\u201D}';
      const result = await enhancedRepairText({
        text: input,
        error: new Error('test'),
      });
      expect(JSON.parse(result!)).toEqual({ status: 'True' });
    });

    it('should preserve // inside smart-quoted string values', async () => {
      const input = '{\u201Curl\u201D: \u201Chttps://example.com/a//b\u201D}';
      const result = await enhancedRepairText({
        text: input,
        error: new Error('test'),
      });
      expect(JSON.parse(result!)).toEqual({
        url: 'https://example.com/a//b',
      });
    });

    it('should preserve inner smart quotes when smart quotes delimit strings', async () => {
      const input = '{\u201Cquote\u201D: \u201CHe said \u201CHi\u201D\u201D}';
      const result = await enhancedRepairText({
        text: input,
        error: new Error('test'),
      });
      expect(JSON.parse(result!)).toEqual({
        quote: 'He said \u201CHi\u201D',
      });
    });

    it('should keep inner smart quotes when followed by punctuation inside string', async () => {
      const input =
        '{\u201Cquote\u201D: \u201CHe said \u201CHi,\u201D and left\u201D}';
      const result = await enhancedRepairText({
        text: input,
        error: new Error('test'),
      });
      expect(JSON.parse(result!)).toEqual({
        quote: 'He said \u201CHi,\u201D and left',
      });
    });

    it('should keep inner smart quotes before a colon inside a string', async () => {
      const input =
        '{\u201Cquote\u201D: \u201CHe said \u201Ckey:\u201D and left\u201D}';
      const result = await enhancedRepairText({
        text: input,
        error: new Error('test'),
      });
      expect(JSON.parse(result!)).toEqual({
        quote: 'He said \u201Ckey:\u201D and left',
      });
    });

    it('should repair a smart-quoted top-level string', async () => {
      const input = '\u201CHello\u201D';
      const result = await enhancedRepairText({
        text: input,
        error: new Error('test'),
      });
      expect(JSON.parse(result!)).toBe('Hello');
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
      const input =
        '{name: "John", active: True, value: None, disabled: False}';
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

    it('should handle JSON wrapped in quotes', async () => {
      // Case 1: JSON wrapped in double quotes with escaped quotes
      const input1 = String.raw`"{\"name\": \"John\", \"age\": 30}"`;
      const result1 = await enhancedRepairText({
        text: input1,
        error: new Error('test'),
      });
      expect(JSON.parse(result1!)).toEqual({ name: 'John', age: 30 });

      // Case 2: JSON wrapped in single quotes
      const input2 = '\'{"name": "John", "age": 30}\'';
      const result2 = await enhancedRepairText({
        text: input2,
        error: new Error('test'),
      });
      expect(JSON.parse(result2!)).toEqual({ name: 'John', age: 30 });
    });

    it('should preserve Python constants inside string values', async () => {
      // Python constants inside strings should NOT be replaced
      const input = '{"status": "True", "value": "None", "flag": "False"}';
      const result = await enhancedRepairText({
        text: input,
        error: new Error('test'),
      });
      const parsed = JSON.parse(result!);
      expect(parsed.status).toBe('True');
      expect(parsed.value).toBe('None');
      expect(parsed.flag).toBe('False');
    });

    it('should preserve block comments inside string values', async () => {
      // Block comments inside strings should NOT be removed
      const input =
        '{"note": "/* keep this comment */", "text": "some /* text */ here"}';
      const result = await enhancedRepairText({
        text: input,
        error: new Error('test'),
      });
      const parsed = JSON.parse(result!);
      expect(parsed.note).toBe('/* keep this comment */');
      expect(parsed.text).toBe('some /* text */ here');
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

  describe('parseJSONWithRepair', () => {
    it('should parse normal JSON', async () => {
      const result = await parseJSONWithRepair('{"name": "John"}');
      expect(result.success).toBe(true);
      expect(result.data).toEqual({ name: 'John' });
      expect(result.repaired).toBeUndefined();
    });

    it('should handle JSON wrapped in quotes', async () => {
      // Case where model returns: "{\"key\": \"value\"}"
      const input = String.raw`"{\"name\": \"John\", \"age\": 30}"`;
      const result = await parseJSONWithRepair(input);
      expect(result.success).toBe(true);
      expect(result.data).toEqual({ name: 'John', age: 30 });
      expect(result.repaired).toBe(true);
    });

    it('should handle JSON array wrapped in quotes', async () => {
      const input = String.raw`"{\"items\": [1, 2, 3]}"`;
      const result = await parseJSONWithRepair(input);
      expect(result.success).toBe(true);
      expect(result.data).toEqual({ items: [1, 2, 3] });
      expect(result.repaired).toBe(true);
    });

    it('should not re-parse valid JSON strings that are meant to be strings', async () => {
      // A string value that happens to look like JSON should remain a string
      const input = '"hello world"';
      const result = await parseJSONWithRepair(input);
      expect(result.success).toBe(true);
      expect(result.data).toBe('hello world');
    });

    it('should use repair function when JSON parsing fails', async () => {
      const input = '{"name": "John",}'; // trailing comma
      const repairFn = getRepairFunction({});
      const result = await parseJSONWithRepair(input, repairFn);
      expect(result.success).toBe(true);
      expect(result.data).toEqual({ name: 'John' });
      expect(result.repaired).toBe(true);
    });
  });

  describe('attemptSchemaRecovery', () => {
    it('should handle non-object schemas (string, number, array)', async () => {
      const { attemptSchemaRecovery } =
        await import('./object-generation-reliability');

      // Test string schema
      const stringResult = await attemptSchemaRecovery('"hello"', {
        type: 'string',
      });
      expect(stringResult.success).toBe(true);
      expect(stringResult.object).toBe('hello');

      // Test number schema
      const numberResult = await attemptSchemaRecovery('42', {
        type: 'number',
      });
      expect(numberResult.success).toBe(true);
      expect(numberResult.object).toBe(42);

      // Test array schema
      const arrayResult = await attemptSchemaRecovery('[1, 2, 3]', {
        type: 'array',
      });
      expect(arrayResult.success).toBe(true);
      expect(Array.isArray(arrayResult.object)).toBe(true);
      expect(arrayResult.object).toEqual([1, 2, 3]);
    });

    it('should reject values that do not match union schema types', async () => {
      const { attemptSchemaRecovery } =
        await import('./object-generation-reliability');

      const result = await attemptSchemaRecovery('true', {
        type: ['string', 'number'],
      });
      expect(result.success).toBe(false);
    });
  });
});
