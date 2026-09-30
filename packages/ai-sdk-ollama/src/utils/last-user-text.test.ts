import { describe, it, expect } from 'vitest';
import { lastUserText } from './last-user-text';

describe('lastUserText', () => {
  it('returns a string prompt as-is', () => {
    expect(lastUserText('Weather in Paris?', undefined)).toBe(
      'Weather in Paris?',
    );
  });

  it('joins text parts of the last user message, skipping later tool/assistant messages', () => {
    expect(
      lastUserText(undefined, [
        { role: 'user', content: 'old question' },
        {
          role: 'user',
          content: [
            { type: 'text', text: 'What is in this image?' },
            { type: 'image', image: new URL('https://example.com/a.png') },
            { type: 'text', text: 'Be brief.' },
          ],
        },
        { role: 'assistant', content: 'Let me check.' },
      ]),
    ).toBe('What is in this image?\nBe brief.');
  });

  it('reads a message-array prompt', () => {
    expect(
      lastUserText([{ role: 'user', content: 'from prompt' }], undefined),
    ).toBe('from prompt');
  });

  it('falls back when there is no user text', () => {
    expect(lastUserText(undefined, [])).toBe('the user question');
    expect(
      lastUserText(undefined, [
        {
          role: 'user',
          content: [{ type: 'image', image: new URL('https://x.test/a.png') }],
        },
      ]),
    ).toBe('the user question');
  });
});
