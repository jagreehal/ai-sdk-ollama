import { LanguageModelV4StreamPart, SharedV4Warning } from '@ai-sdk/provider';
import { ChatResponse, ToolCall } from 'ollama';
import { mapOllamaFinishReason } from '../utils/map-ollama-finish-reason';
import { aggregateUsage, ollamaResponseDetails } from './chat-result';

type Controller = TransformStreamDefaultController<LanguageModelV4StreamPart>;

/**
 * Turns Ollama's chunk stream into AI SDK stream parts.
 *
 * Ollama can deliver the same content either in an intermediate chunk or
 * attached to the final `done` chunk, so both paths drive the same emitters
 * rather than repeating the text/reasoning/tool-call bookkeeping. Text and
 * reasoning are mutually exclusive: any text closes an open reasoning block.
 */
export function createChunkTransformer({
  warnings,
  reasoningEnabled,
  includeRawChunks,
}: {
  warnings: SharedV4Warning[];
  reasoningEnabled: boolean;
  includeRawChunks?: boolean;
}): TransformStream<ChatResponse, LanguageModelV4StreamPart> {
  let streamStarted = false;
  let textId: string | undefined;
  let reasoningId: string | undefined;
  let hasToolCalls = false;

  function endReasoning(controller: Controller) {
    if (reasoningId === undefined) {
      return;
    }
    controller.enqueue({ type: 'reasoning-end', id: reasoningId });
    reasoningId = undefined;
  }

  function emitReasoning(controller: Controller, delta: string) {
    if (reasoningId === undefined) {
      reasoningId = crypto.randomUUID();
      controller.enqueue({ type: 'reasoning-start', id: reasoningId });
    }
    controller.enqueue({ type: 'reasoning-delta', id: reasoningId, delta });
  }

  function emitText(controller: Controller, delta: string) {
    endReasoning(controller);
    if (textId === undefined) {
      textId = crypto.randomUUID();
      controller.enqueue({ type: 'text-start', id: textId });
    }
    controller.enqueue({ type: 'text-delta', id: textId, delta });
  }

  function endText(controller: Controller) {
    if (textId === undefined) {
      return;
    }
    controller.enqueue({ type: 'text-end', id: textId });
    textId = undefined;
  }

  function emitToolCalls(
    controller: Controller,
    toolCalls: ToolCall[] | undefined,
  ) {
    if (!toolCalls || toolCalls.length === 0) {
      return;
    }
    hasToolCalls = true;
    for (const toolCall of toolCalls) {
      controller.enqueue({
        type: 'tool-call',
        toolCallId: crypto.randomUUID(), // Ollama does not provide tool call IDs
        toolName: toolCall.function.name,
        input: JSON.stringify(toolCall.function.arguments || {}),
      });
    }
  }

  return new TransformStream<ChatResponse, LanguageModelV4StreamPart>({
    transform(chunk, controller) {
      if (!streamStarted) {
        controller.enqueue({ type: 'stream-start', warnings });
        streamStarted = true;
      }

      if (!chunk || typeof chunk !== 'object') {
        return; // skip malformed chunks
      }

      if (includeRawChunks) {
        controller.enqueue({ type: 'raw', rawValue: chunk });
      }

      const content = chunk.message?.content;
      const hasContent = typeof content === 'string' && content.length > 0;

      if (chunk.done) {
        endReasoning(controller);
        if (hasContent) {
          emitText(controller, content);
        }
        endText(controller);
        // Some models only report their tool calls on the final chunk.
        emitToolCalls(controller, chunk.message?.tool_calls);

        controller.enqueue({
          type: 'finish',
          finishReason: mapOllamaFinishReason(chunk.done_reason, hasToolCalls),
          usage: aggregateUsage(chunk),
          providerMetadata: { ollama: ollamaResponseDetails(chunk) },
        });
        return;
      }

      const thinking = chunk.message?.thinking;
      if (thinking && reasoningEnabled) {
        emitReasoning(controller, thinking);
      }

      emitToolCalls(controller, chunk.message?.tool_calls);

      if (hasContent) {
        emitText(controller, content);
      }
    },
  });
}
