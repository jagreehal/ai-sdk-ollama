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
              (part): part is Extract<typeof part, { type: 'image' }> =>
                part.type === 'image',
            )
            .map((part) => {
              if (part.image instanceof URL) {
                return part.image.href;
              } else if (typeof part.image === 'string') {
                return part.image;
              } else if (part.image instanceof Uint8Array) {
                // Handle Uint8Array by converting to base64
                return `data:image/jpeg;base64,${Buffer.from(part.image).toString('base64')}`;
              } else {
                // Fallback for other types
                return String(part.image);
              }
            });

          messages.push({
            role: 'user',
            content: textParts,
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
              .map(
                (tc) =>
                  `[Tool Call: ${tc.toolName}(${JSON.stringify(tc.args)})]`,
              )
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
          content: `[Tool Result for ${message.content[0]?.toolName}]: ${JSON.stringify(message.content[0]?.result)}`,
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
