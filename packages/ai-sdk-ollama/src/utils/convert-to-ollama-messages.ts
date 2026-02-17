import { LanguageModelV3Prompt } from '@ai-sdk/provider';
import { Message as OllamaMessage } from 'ollama';

import { parseToolArguments } from './tool-calling-reliability';

function normalizeImageDataForOllama(
  imageData: URL | string | Uint8Array,
): string | null {
  if (imageData instanceof URL) {
    if (imageData.protocol === 'data:') {
      const base64Match = imageData.href.match(/data:[^;]+;base64,(.+)/);
      const extracted = base64Match?.[1];
      if (typeof extracted === 'string') return extracted;
      return imageData.href;
    }
    return imageData.href;
  }
  if (typeof imageData === 'string') {
    if (imageData.startsWith('data:')) {
      const base64Match = imageData.match(/data:[^;]+;base64,(.+)/);
      const extracted = base64Match?.[1];
      if (typeof extracted === 'string') return extracted;
    }
    return imageData;
  }
  if (imageData instanceof Uint8Array) {
    return Buffer.from(imageData).toString('base64');
  }
  return null;
}

/**
 * Enhanced message conversion that supports all Ollama capabilities
 * and handles edge cases better than the referenced implementation
 */
export function convertToOllamaChatMessages(
  prompt: LanguageModelV3Prompt,
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
          // Handle multi-part content with enhanced image support
          const textParts = message.content
            .filter((part) => part.type === 'text')
            .map((part) => part.text)
            .join('\n');

          const imageParts = message.content
            .filter(
              (part): part is Extract<typeof part, { type: 'file' }> =>
                part.type === 'file',
            )
            .filter((part) => part.mediaType?.startsWith('image/') ?? false)
            .map((part) => normalizeImageDataForOllama(part.data))
            .filter((img): img is string => img !== null);

          messages.push({
            role: 'user',
            content: textParts || '', // Ensure content is never undefined
            images: imageParts.length > 0 ? imageParts : undefined,
          });
        }
        break;
      }

      case 'assistant': {
        let content: string;
        const toolCalls: Array<{
          id?: string;
          type: 'function';
          function: {
            name: string;
            arguments: Record<string, unknown>;
          };
        }> = [];

        if (typeof message.content === 'string') {
          content = message.content;
        } else {
          // Enhanced content handling with proper tool call support
          const textParts = message.content
            .filter((part) => part.type === 'text')
            .map((part) => part.text)
            .join('');

          const reasoningParts = message.content
            .filter((part) => part.type === 'reasoning')
            .map((part) => part.text)
            .join('\n');

          // Combine text and reasoning
          content = [textParts, reasoningParts].filter(Boolean).join('\n');

          // Handle tool calls properly - Ollama DOES support native tool calls
          for (const part of message.content) {
            if (part.type === 'tool-call') {
              const args = parseToolArguments(part.input);

              toolCalls.push({
                id: part.toolCallId,
                type: 'function',
                function: {
                  name: part.toolName,
                  arguments: args,
                },
              });
            }
          }
        }

        messages.push({
          role: 'assistant',
          content: content || '', // Ensure content is never undefined
          tool_calls: toolCalls.length > 0 ? toolCalls : undefined,
        });
        break;
      }

      case 'tool': {
        // Handle tool result messages - Ollama supports native tool role with tool_name
        if (typeof message.content === 'string') {
          messages.push({
            role: 'tool',
            content: message.content,
          });
        } else {
          for (const part of message.content) {
            if (part.type !== 'tool-result') continue;

            if (part.output.type === 'content') {
              const textParts: string[] = [];
              const imageParts: string[] = [];
              for (const item of part.output.value) {
                switch (item.type) {
                  case 'text': {
                    textParts.push(item.text);
                    break;
                  }
                  case 'image-data': {
                    const normalized = normalizeImageDataForOllama(item.data);
                    if (normalized) imageParts.push(normalized);
                    break;
                  }
                  case 'image-url': {
                    imageParts.push(item.url);
                    break;
                  }
                  case 'file-data': {
                    if (item.mediaType?.startsWith('image/')) {
                      const normalized = normalizeImageDataForOllama(item.data);
                      if (normalized) imageParts.push(normalized);
                    }
                    break;
                  }
                }
              }
              messages.push({
                role: 'tool',
                content: textParts.join('\n') || '',
                tool_name: part.toolName,
                images: imageParts.length > 0 ? imageParts : undefined,
              });
              continue;
            }

            const contentValue =
              part.output.type === 'text' || part.output.type === 'error-text'
                ? part.output.value
                : part.output.type === 'json' ||
                    part.output.type === 'error-json'
                  ? JSON.stringify(part.output.value)
                  : part.output.type === 'execution-denied'
                    ? ''
                    : JSON.stringify(part.output);

            messages.push({
              role: 'tool',
              content: contentValue,
              tool_name: part.toolName,
            });
          }
        }
        break;
      }

      default: {
        // Enhanced error handling with more descriptive messages
        const role = (message as { role: string }).role;
        throw new Error(
          `Unsupported message role: ${role}. Supported roles are: system, user, assistant, tool`,
        );
      }
    }
  }

  return messages;
}
