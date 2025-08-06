import { LanguageModelV2Prompt } from '@ai-sdk/provider';
import { Message as OllamaMessage } from 'ollama';

export function convertToOllamaChatMessages(
  prompt: LanguageModelV2Prompt,
): OllamaMessage[] {
  const messages: OllamaMessage[] = [];

  for (const message of prompt) {
    switch (message.role) {
      case 'system': {
        messages.push({
          role: 'system',
          content: message.content,
        });
        break;
      }

      case 'user': {
        if (typeof message.content === 'string') {
          messages.push({
            role: 'user',
            content: message.content,
          });
        } else {
          // Handle multi-part content
          const textParts = message.content
            .filter((part) => part.type === 'text')
            .map((part) => part.text)
            .join('\n');

          const imageParts = message.content
            .filter(
              (part): part is Extract<typeof part, { type: 'file' }> =>
                part.type === 'file',
            )
            .filter((part) => part.mediaType.startsWith('image/'))
            .map((part) => {
              if (part.data instanceof URL) {
                return part.data.href;
              } else if (typeof part.data === 'string') {
                // If it's already a data URL, extract just the base64 part
                if (part.data.startsWith('data:')) {
                  const base64Match = part.data.match(/data:[^;]+;base64,(.+)/);
                  if (base64Match) {
                    return base64Match[1]; // Return just the base64 part
                  }
                }
                return part.data;
              } else if (part.data instanceof Uint8Array) {
                // Handle Uint8Array by converting to base64 (without data URL prefix)
                return Buffer.from(part.data).toString('base64');
              } else {
                // Fallback for other types
                return String(part.data);
              }
            });

          messages.push({
            role: 'user',
            content: textParts,
            images:
              imageParts.length > 0
                ? imageParts.filter((img): img is string => img !== undefined)
                : undefined,
          });
        }
        break;
      }

      case 'assistant': {
        let content = '';

        if (typeof message.content === 'string') {
          content = message.content;
        } else {
          // Combine text parts
          content = message.content
            .filter((part) => part.type === 'text')
            .map((part) => part.text)
            .join('');

          // Handle tool calls if present
          const toolCalls = message.content.filter(
            (part) => part.type === 'tool-call',
          );
          if (toolCalls.length > 0) {
            // For now, we'll append tool calls as text since Ollama doesn't have native support
            const toolCallText = toolCalls
              .map((tc) => `[Tool Call: ${tc.toolName}]`)
              .join('\n');
            if (toolCallText) {
              content = content ? `${content}\n${toolCallText}` : toolCallText;
            }
          }
        }

        messages.push({
          role: 'assistant',
          content,
        });
        break;
      }

      case 'tool': {
        // Ollama doesn't have native tool result support, so we'll add it as a user message
        messages.push({
          role: 'user',
          content: `[Tool Result]`,
        });
        break;
      }

      default: {
        // Handle unknown message roles
        throw new Error(
          `Unsupported message role: ${(message as { role: string }).role}`,
        );
      }
    }
  }

  return messages;
}
