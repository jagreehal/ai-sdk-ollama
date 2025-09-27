/**
 * streamText - Enhanced streamText with Ollama-specific reliability
 *
 * This wrapper provides streaming tool calling reliability by detecting
 * when tools execute but no text is streamed, then providing synthesis.
 */

import { streamText as _streamText } from 'ai';
import type { LanguageModel } from 'ai';

export interface StreamTextOptions {
  model: LanguageModel;
  system?: string;
  prompt?: string;
  messages?: Parameters<typeof _streamText>[0]['messages'];
  tools?: Parameters<typeof _streamText>[0]['tools'];
  maxOutputTokens?: number;
  temperature?: number;
  topP?: number;
  topK?: number;
  presencePenalty?: number;
  frequencyPenalty?: number;
  stopSequences?: string[];
  seed?: number;
  maxRetries?: number;
  abortSignal?: AbortSignal;
  headers?: Record<string, string>;
  /**
   * Enhanced options for Ollama-specific reliability features
   */
  enhancedOptions?: {
    /**
     * Enable enhanced tool calling logging
     * @default true
     */
    enableToolLogging?: boolean;

    /**
     * Enable streaming synthesis when tools execute but no text streams
     * @default true
     */
    enableStreamingSynthesis?: boolean;

    /**
     * Minimum streamed characters before considering it successful
     * @default 10
     */
    minStreamLength?: number;

    /**
     * Timeout in ms to wait for streaming before applying synthesis
     * @default 3000
     */
    synthesisTimeout?: number;
  };
}

/**
 * Enhanced streamText function with Ollama-specific reliability improvements
 */
export async function streamText(options: StreamTextOptions) {
  const { enhancedOptions = {}, ...streamTextOptions } = options;

  const {
    enableStreamingSynthesis = true,
    minStreamLength = 10,
    synthesisTimeout = 3000,
  } = enhancedOptions;

  const hasTools = options.tools && Object.keys(options.tools).length > 0;

  // If no tools, just use standard streaming
  if (!hasTools || !enableStreamingSynthesis) {
    return _streamText(streamTextOptions as Parameters<typeof _streamText>[0]);
  }

  // Enhanced streaming with tool calling reliability
  const streamResult = await _streamText(
    streamTextOptions as Parameters<typeof _streamText>[0],
  );

  // Create enhanced stream that detects tool execution without text streaming
  let streamedContent = '';
  let synthesisApplied = false;

  const originalTextStream = streamResult.textStream;

  // Resolve tool information once
  const finalResultPromise = (async () => {
    const finalResult = await streamResult;
    const [toolCalls, toolResults] = await Promise.all([
      finalResult.toolCalls,
      finalResult.toolResults,
    ]);
    return { finalResult, toolCalls, toolResults } as const;
  })();

  const applySynthesisIfNeeded = async (
    controller: ReadableStreamDefaultController<string>,
  ) => {
    if (synthesisApplied) {
      return false;
    }

    try {
      const { toolCalls, toolResults } = await finalResultPromise;

      if (!toolCalls || toolCalls.length === 0) {
        return false;
      }

      if (streamedContent.length >= minStreamLength) {
        return false;
      }

      synthesisApplied = true;

      const toolContext =
        toolResults
          ?.map((tr, index) => {
            const toolName = toolCalls[index]?.toolName || 'Tool';
            return `${toolName}: ${JSON.stringify(tr)}`;
          })
          .join('\n') || '';

      const originalPromptText =
        typeof options.prompt === 'string'
          ? options.prompt
          : options.messages?.at(-1)?.content || 'the user question';

      const synthesisPrompt = `Original request: ${originalPromptText}

Tool results:
${toolContext}

Based on the tool results above, please provide a comprehensive response to the original question.`;

      try {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { tools, prompt, ...baseOptions } =
          streamTextOptions as Parameters<typeof _streamText>[0];

        const synthesisStream = await _streamText({
          ...baseOptions,
          prompt: synthesisPrompt,
        } as Parameters<typeof _streamText>[0]);

        // Stream the synthesis response in real-time
        const reader = synthesisStream.textStream.getReader();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          // Check if controller is still open before enqueuing
          try {
            controller.enqueue(value);
          } catch (error) {
            if (
              error instanceof TypeError &&
              error.message.includes('Controller is already closed')
            ) {
              // Controller was closed, stop streaming
              break;
            }
            throw error;
          }
        }
      } catch (error) {
        console.warn('🔧 Synthesis failed:', error);
      }

      return true;
    } catch (error) {
      console.warn('🔧 Unable to apply synthesis:', error);
      return false;
    }
  };

  // Create a new readable stream that adds synthesis when needed
  const enhancedTextStream = new ReadableStream({
    async start(controller) {
      let streamTimeout: NodeJS.Timeout | null = null;
      let streamComplete = false;
      let controllerClosed = false;

      // Helper function to safely close controller
      const safeClose = () => {
        if (!controllerClosed) {
          controllerClosed = true;
          try {
            controller.close();
          } catch {
            // Controller already closed, ignore
          }
        }
      };

      // Set a timeout to detect if streaming stalls after tools
      const resetTimeout = () => {
        if (streamTimeout) clearTimeout(streamTimeout);
        streamTimeout = setTimeout(async () => {
          if (!streamComplete && !synthesisApplied && !controllerClosed) {
            await applySynthesisIfNeeded(controller);
          }
          safeClose();
        }, synthesisTimeout);
      };

      try {
        resetTimeout();

        // Process the original stream
        const reader = originalTextStream.getReader();

        while (true) {
          const { done, value } = await reader.read();

          if (done) {
            streamComplete = true;
            if (streamTimeout) clearTimeout(streamTimeout);
            if (!synthesisApplied && !controllerClosed) {
              await applySynthesisIfNeeded(controller);
            }
            safeClose();
            break;
          }

          if (value) {
            streamedContent += value;
            controller.enqueue(value);
            resetTimeout(); // Reset timeout on each chunk
          }
        }
      } catch (error) {
        if (!controllerClosed) {
          controller.error(error);
        }
      }
    },
  });

  // Return enhanced result with our reliable stream while preserving original prototype methods
  const enhancedResult = Object.create(
    Object.getPrototypeOf(streamResult),
    Object.getOwnPropertyDescriptors(streamResult),
  ) as typeof streamResult;

  Object.defineProperty(enhancedResult, 'textStream', {
    get: () => enhancedTextStream,
    enumerable: true,
  });

  return enhancedResult;
}
