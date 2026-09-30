import type { ModelMessage } from 'ai';

/**
 * Text of the latest user message (its text parts joined), used to restate
 * the request when synthesising a reply from tool results.
 */
export function lastUserText(
  prompt: string | ModelMessage[] | undefined,
  messages: ModelMessage[] | undefined,
): string {
  if (typeof prompt === 'string') return prompt;

  // The browser build targets ES2020, which lacks findLast.
  const lastUser = [...(prompt ?? messages ?? [])]
    .reverse()
    .find((message) => message.role === 'user');
  if (!lastUser) return 'the user question';
  if (typeof lastUser.content === 'string') return lastUser.content;

  const text = lastUser.content
    .flatMap((part) => (part.type === 'text' ? [part.text] : []))
    .join('\n');
  return text || 'the user question';
}
