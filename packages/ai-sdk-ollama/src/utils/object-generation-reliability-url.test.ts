import { describe, it, expect } from 'vitest';
import { enhancedRepairText } from './object-generation-reliability';

describe('Enhanced JSON Repair - URL Handling', () => {
  it('should preserve URLs with // inside single-quoted strings', async () => {
    const input = "{'url': 'https://example.com', 'name': 'foo'}";
    const result = await enhancedRepairText({
      text: input,
      error: new Error('test'),
    });
    const parsed = JSON.parse(result!);
    expect(parsed.url).toBe('https://example.com');
    expect(parsed.name).toBe('foo');
  });

  it('should preserve URLs with // inside double-quoted strings', async () => {
    const input = '{"url": "https://example.com", "name": "bar"}';
    const result = await enhancedRepairText({
      text: input,
      error: new Error('test'),
    });
    const parsed = JSON.parse(result!);
    expect(parsed.url).toBe('https://example.com');
    expect(parsed.name).toBe('bar');
  });

  it('should handle multiple URLs in the same object', async () => {
    const input = `{
      api: 'https://api.example.com',
      website: 'http://example.com',
      // This is a comment
      cdn: 'https://cdn.example.com'
    }`;
    const result = await enhancedRepairText({
      text: input,
      error: new Error('test'),
    });
    const parsed = JSON.parse(result!);
    expect(parsed.api).toBe('https://api.example.com');
    expect(parsed.website).toBe('http://example.com');
    expect(parsed.cdn).toBe('https://cdn.example.com');
  });

  it('should remove actual comments while preserving URLs', async () => {
    const input = `{
      url: 'https://example.com',
      path: '/api/v1'
    }`;
    const result = await enhancedRepairText({
      text: input,
      error: new Error('test'),
    });
    const parsed = JSON.parse(result!);
    expect(parsed.url).toBe('https://example.com');
    expect(parsed.path).toBe('/api/v1');
  });

  it('should handle protocol-relative URLs', async () => {
    const input = "{url: '//example.com/path', secure: false}";
    const result = await enhancedRepairText({
      text: input,
      error: new Error('test'),
    });
    const parsed = JSON.parse(result!);
    expect(parsed.url).toBe('//example.com/path');
    expect(parsed.secure).toBe(false);
  });

  it('should preserve // in strings with escaped single quotes', async () => {
    const input = String.raw`{'description': 'It\'s not // comment', 'value': 42}`;
    const result = await enhancedRepairText({
      text: input,
      error: new Error('test'),
    });
    const parsed = JSON.parse(result!);
    expect(parsed.description).toBe("It's not // comment");
    expect(parsed.value).toBe(42);
  });

  it('should preserve // in strings with escaped double quotes', async () => {
    const input = String.raw`{"text": "He said \"It's // fine\"", "ok": true}`;
    const result = await enhancedRepairText({
      text: input,
      error: new Error('test'),
    });
    const parsed = JSON.parse(result!);
    expect(parsed.text).toBe('He said "It\'s // fine"');
    expect(parsed.ok).toBe(true);
  });

  it('should remove actual comments but preserve // in strings with escaped quotes', async () => {
    const input = `{
      url: 'https://example.com',
      desc: 'A URL // not a comment',
      // This is an actual comment
      value: 123
    }`;
    const result = await enhancedRepairText({
      text: input,
      error: new Error('test'),
    });
    const parsed = JSON.parse(result!);
    expect(parsed.url).toBe('https://example.com');
    expect(parsed.desc).toBe('A URL // not a comment');
    expect(parsed.value).toBe(123);
    expect(result).not.toContain('This is an actual comment');
  });

  it('should handle paths with backslashes and preserve URLs', async () => {
    const input = String.raw`{"path": "C:\\Program Files\\App", "url": "https://example.com"}`;
    const result = await enhancedRepairText({
      text: input,
      error: new Error('test'),
    });
    const parsed = JSON.parse(result!);
    expect(parsed.path).toBe(String.raw`C:\Program Files\App`);
    expect(parsed.url).toBe('https://example.com');
  });

  it('should remove trailing comments after URLs in strings', async () => {
    const input = '{"text": "https://example.com" // this is a comment}';
    const result = await enhancedRepairText({
      text: input,
      error: new Error('test'),
    });
    const parsed = JSON.parse(result!);
    expect(parsed.text).toBe('https://example.com');
    expect(result).not.toContain('this is a comment');
  });

  it('should handle multiple // on same line - preserve in string, remove comment', async () => {
    const input =
      '{"url": "https://example.com", "path": "//cdn.example.com" // comment here}';
    const result = await enhancedRepairText({
      text: input,
      error: new Error('test'),
    });
    const parsed = JSON.parse(result!);
    expect(parsed.url).toBe('https://example.com');
    expect(parsed.path).toBe('//cdn.example.com');
    expect(result).not.toContain('comment here');
  });

  it('should remove comment after string with URL on same line', async () => {
    const input = `{
      "api": "https://api.example.com", // API endpoint
      "version": 1
    }`;
    const result = await enhancedRepairText({
      text: input,
      error: new Error('test'),
    });
    const parsed = JSON.parse(result!);
    expect(parsed.api).toBe('https://api.example.com');
    expect(parsed.version).toBe(1);
    expect(result).not.toContain('API endpoint');
  });
});
