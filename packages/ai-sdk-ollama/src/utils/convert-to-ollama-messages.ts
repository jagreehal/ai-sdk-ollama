import { LanguageModelV3Prompt } from '@ai-sdk/provider';
import { Message as OllamaMessage } from 'ollama';

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
              // Parse the input - it should be a JSON string from AI SDK
              let args: Record<string, unknown>;
              try {
                args =
                  typeof part.input === 'string'
                    ? JSON.parse(part.input)
                    : (part.input as Record<string, unknown>);
              } catch (error) {
                console.warn('Failed to parse tool call input:', error);
                args = {};
              }

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
          // Handle multi-part tool results
          for (const part of message.content) {
            if (part.type === 'tool-result') {
              const contentValue =
                part.output.type === 'text' || part.output.type === 'error-text'
                  ? part.output.value
                  : part.output.type === 'json' ||
                      part.output.type === 'error-json'
                    ? JSON.stringify(part.output.value)
                    : JSON.stringify(part.output);

              // Ollama's Message interface supports tool_name field for tool results
              messages.push({
                role: 'tool',
                content: contentValue,
                tool_name: part.toolName,
              });
            }
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
