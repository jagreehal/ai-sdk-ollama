import { describe, it, expect } from 'vitest';
import { fixTypeMismatches } from './json-schema-coercion';

describe('fixTypeMismatches', () => {
  it('coerces values for string fields, serialising objects as JSON', () => {
    const schema = {
      type: 'object',
      properties: {
        name: { type: 'string' },
        count: { type: 'string' },
        meta: { type: 'string' },
        missing: { type: 'string' },
      },
    };

    expect(
      fixTypeMismatches(
        { name: 'Ada', count: 3, meta: { a: 1 }, missing: undefined },
        schema,
      ),
    ).toMatchObject({ name: 'Ada', count: '3', meta: '{"a":1}', missing: '' });
  });
});
