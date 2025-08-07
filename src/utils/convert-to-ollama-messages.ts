import { LanguageModelV2Prompt } from '@ai-sdk/provider';
import { Message as OllamaMessage } from 'ollama';

/**
 * Enhanced message conversion that supports all Ollama capabilities
 * and handles edge cases better than the referenced implementation
 */
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
            .filter((part) => {
              // Support image files only
              return part.mediaType?.startsWith('image/') || false;
            })
            .map((part) => {
              const imageData = part.data;

              if (imageData instanceof URL) {
                // Handle image URLs - extract base64 from data URLs or use URL directly
                if (imageData.protocol === 'data:') {
                  const base64Match = imageData.href.match(
                    /data:[^;]+;base64,(.+)/,
                  );
                  if (base64Match) {
                    return base64Match[1]; // Return just the base64 part
                  }
                  // If no base64 match, return the full data URL
                  return imageData.href;
                }
                // For HTTP URLs, return as-is (Ollama will handle them)
                return imageData.href;
              } else if (typeof imageData === 'string') {
                // Handle base64 strings
                if (imageData.startsWith('data:')) {
                  const base64Match = imageData.match(/data:[^;]+;base64,(.+)/);
                  if (base64Match) {
                    return base64Match[1]; // Return just the base64 part
                  }
                }
                return imageData;
              } else if (imageData instanceof Uint8Array) {
                // Handle Uint8Array by converting to base64
                return Buffer.from(imageData).toString('base64');
              } else {
                // Fallback for other types
                console.warn(
                  `Unsupported image data type: ${typeof imageData}`,
                );
                return null;
              }
            })
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
        let content = '';

        if (typeof message.content === 'string') {
          content = message.content;
        } else {
          // Enhanced content handling with better tool call support
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
          content: content || '', // Ensure content is never undefined
        });
        break;
      }

      case 'tool': {
        // Enhanced tool result handling
        if (typeof message.content === 'string') {
          messages.push({
            role: 'user', // Ollama doesn't have native tool role, so we use user
            content: `[Tool Result]: ${message.content}`,
          });
        } else {
          // Handle multi-part tool results
          const toolResultParts = message.content
            .filter((part) => part.type === 'tool-result')
            .map((part) => {
              if (part.output.type === 'text') {
                return part.output.value;
              } else if (part.output.type === 'json') {
                return JSON.stringify(part.output.value);
              }
              return String(part.output.value);
            })
            .join('\n');

          messages.push({
            role: 'user',
            content: `[Tool Result]: ${toolResultParts || ''}`,
          });
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
