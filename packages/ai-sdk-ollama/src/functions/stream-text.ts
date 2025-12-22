/**
 * streamText - Enhanced streamText with Ollama-specific reliability
 *
 * This wrapper provides streaming tool calling reliability by detecting
 * when tools execute but no text is streamed, then providing synthesis.
 *
 * Enhances both `textStream` and `fullStream` with synthesis support.
 */

import { streamText as _streamText, stepCountIs } from 'ai';

// Extract the AI SDK's streamText options type for full compatibility
type AIStreamTextOptions = Parameters<typeof _streamText>[0];

/**
 * TextStreamPart type for fullStream synthesis
 * Mirrors the AI SDK's TextStreamPart structure
 */
type SynthesisStreamPart =
  | { type: 'text-start'; id: string }
  | { type: 'text-delta'; id: string; text: string; delta?: string }
  | { type: 'text-end'; id: string }
  | { type: 'tool-call'; toolCallId: string; toolName: string; input: unknown }
  | { type: 'tool-result'; toolCallId: string; toolName: string; output: unknown }
  | { type: 'finish'; finishReason: string; totalUsage: { inputTokens: number; outputTokens: number; totalTokens: number } }
  | { type: 'start' }
  | { type: 'start-step'; request: unknown; warnings: unknown[] }
  | { type: 'finish-step'; response: unknown; usage: unknown; finishReason: string; providerMetadata: unknown }
  | { type: string; [key: string]: unknown };

/**
 * Type for parts from the AI SDK's fullStream
 * This is more permissive to handle all possible stream part types
 */
type StreamPart = {
  type: string;
  [key: string]: unknown;
};

/**
 * Enhanced streamText options that extend the official AI SDK options
 * This ensures 100% compatibility - all AI SDK properties are supported
 */
export type StreamTextOptions = AIStreamTextOptions & {
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
 * Collected stream state for synthesis decision
 */
interface StreamState {
  textContent: string;
  toolCalls: Array<{ toolCallId: string; toolName: string; input: unknown }>;
  toolResults: Array<{ toolCallId: string; toolName: string; output: unknown }>;
  hasFinished: boolean;
  parts: SynthesisStreamPart[];
}

/**
 * Enhanced streamText function with Ollama-specific reliability improvements
 * Enhances both textStream and fullStream with synthesis support
 */
export async function streamText(options: StreamTextOptions): Promise<Awaited<ReturnType<typeof _streamText>>> {
  const { enhancedOptions = {}, ...streamTextOptions } = options;

  const {
    enableStreamingSynthesis = true,
    minStreamLength = 10,
    synthesisTimeout = 3000,
  } = enhancedOptions;

  const hasTools = options.tools && Object.keys(options.tools).length > 0;

  // If no tools, just use standard streaming - forward all options automatically
  if (!hasTools || !enableStreamingSynthesis) {
    return _streamText(streamTextOptions as Parameters<typeof _streamText>[0]);
  }

  // Enhanced streaming with tool calling reliability
  // Automatically forward all AI SDK options, only override stopWhen if needed
  const streamResult = await _streamText({
    ...(streamTextOptions as Parameters<typeof _streamText>[0]),
    // Only set stopWhen default if user didn't provide one and tools are enabled
    stopWhen: streamTextOptions.stopWhen ?? (hasTools ? stepCountIs(5) : undefined),
  });

  // Shared state for synthesis
  const state: StreamState = {
    textContent: '',
    toolCalls: [],
    toolResults: [],
    hasFinished: false,
    parts: [],
  };

  let synthesisApplied = false;
  let synthesisInProgress = false;

  /**
   * Generate synthesis response and return text chunks
   */
  const generateSynthesis = async (): Promise<string> => {
    if (synthesisApplied || synthesisInProgress) {
      return '';
    }

    // Check if synthesis is needed
    if (state.toolCalls.length === 0) {
      return '';
    }

    if (state.textContent.length >= minStreamLength) {
      return '';
    }

    synthesisInProgress = true;

    try {
      const toolContext =
        state.toolResults
          .map((tr) => {
            return `${tr.toolName}: ${JSON.stringify(tr.output)}`;
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

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { tools, prompt, messages, ...baseOptions } =
        streamTextOptions as Parameters<typeof _streamText>[0];

      // Use messages pattern if original call used messages, otherwise use prompt
      const synthesisOptions = messages
        ? {
            ...baseOptions,
            messages: [
              ...(messages || []),
              { role: 'user' as const, content: synthesisPrompt },
            ],
          }
        : {
            ...baseOptions,
            prompt: synthesisPrompt,
          };

      const synthesisStream = await _streamText(
        synthesisOptions as Parameters<typeof _streamText>[0],
      );

      // Collect synthesis text
      let synthesisText = '';
      for await (const chunk of synthesisStream.textStream) {
        synthesisText += chunk;
      }

      synthesisApplied = true;
      return synthesisText;
    } catch (error) {
      console.warn('🔧 Synthesis failed:', error);
      return '';
    } finally {
      synthesisInProgress = false;
    }
  };

  /**
   * Create enhanced textStream with synthesis support
   */
  const createEnhancedTextStream = () => {
    // Get the original text stream
    const originalTextStream = streamResult.textStream;

    return new ReadableStream<string>({
      async start(controller) {
        let streamTimeout: ReturnType<typeof setTimeout> | null = null;
        let streamComplete = false;
        let controllerClosed = false;

        const safeClose = () => {
          if (!controllerClosed) {
            controllerClosed = true;
            try {
              controller.close();
            } catch {
              // Controller already closed
            }
          }
        };

        const safeEnqueue = (value: string) => {
          if (!controllerClosed) {
            try {
              controller.enqueue(value);
              return true;
            } catch {
              controllerClosed = true;
              return false;
            }
          }
          return false;
        };

        const applySynthesis = async () => {
          if (synthesisApplied || controllerClosed) return;

          const synthesisText = await generateSynthesis();
          if (synthesisText && !controllerClosed) {
            // Stream synthesis character by character for smooth experience
            for (const char of synthesisText) {
              if (!safeEnqueue(char)) break;
            }
          }
        };

        const resetTimeout = () => {
          if (streamTimeout) clearTimeout(streamTimeout);
          streamTimeout = setTimeout(async () => {
            if (!streamComplete && !synthesisApplied && !controllerClosed) {
              await applySynthesis();
            }
            safeClose();
          }, synthesisTimeout);
        };

        try {
          resetTimeout();
          const reader = originalTextStream.getReader();

          while (true) {
            const { done, value } = await reader.read();

            if (done) {
              streamComplete = true;
              if (streamTimeout) clearTimeout(streamTimeout);
              state.hasFinished = true;

              if (!synthesisApplied && !controllerClosed) {
                await applySynthesis();
              }
              safeClose();
              break;
            }

            if (value) {
              state.textContent += value;
              safeEnqueue(value);
              resetTimeout();
            }
          }
        } catch (error) {
          if (!controllerClosed) {
            controller.error(error);
          }
        }
      },
    });
  };

  /**
   * Create enhanced fullStream with synthesis support
   * Emits proper TextStreamPart objects including synthesized text parts
   * Streams events in real-time instead of waiting for completion
   */
  const createEnhancedFullStream = () => {
    // Get the original fullStream to consume in real-time
    const originalFullStream = streamResult.fullStream;

    return new ReadableStream<SynthesisStreamPart>({
      async start(controller) {
        let controllerClosed = false;
        let hasSeenText = false;
        let currentTextId: string | null = null;

        const safeClose = () => {
          if (!controllerClosed) {
            controllerClosed = true;
            try {
              controller.close();
            } catch {
              // Controller already closed
            }
          }
        };

        const safeEnqueue = (part: SynthesisStreamPart) => {
          if (!controllerClosed) {
            try {
              controller.enqueue(part);
              return true;
            } catch {
              controllerClosed = true;
              return false;
            }
          }
          return false;
        };

        try {
          const reader = originalFullStream.getReader();

          while (true) {
            const { done, value } = await reader.read();

            if (done) {
              state.hasFinished = true;

              // Check if we need synthesis before finishing
              const finalResult = await streamResult;
              const [toolCalls, toolResults, text] = await Promise.all([
                finalResult.toolCalls,
                finalResult.toolResults,
                finalResult.text,
              ]);

              // Update state with final values
              state.textContent = text || '';
              if (toolCalls) {
                state.toolCalls = toolCalls.map((tc) => ({
                  toolCallId: tc.toolCallId,
                  toolName: tc.toolName,
                  input: tc.input,
                }));
              }
              if (toolResults) {
                state.toolResults = toolResults.map((tr) => ({
                  toolCallId: tr.toolCallId,
                  toolName: tr.toolName,
                  output: tr.output,
                }));
              }

              // Check if synthesis is needed
              if (
                state.toolCalls.length > 0 &&
                state.textContent.length < minStreamLength &&
                !hasSeenText
              ) {
                const synthesisText = await generateSynthesis();
                if (synthesisText && synthesisText.length > 0) {
                  // Emit synthesized text
                  currentTextId = crypto.randomUUID();
                  safeEnqueue({ type: 'text-start', id: currentTextId });

                  // Emit text in chunks for streaming effect
                  const chunkSize = 10;
                  for (let i = 0; i < synthesisText.length; i += chunkSize) {
                    const chunk = synthesisText.slice(i, i + chunkSize);
                    safeEnqueue({
                      type: 'text-delta',
                      id: currentTextId,
                      text: chunk,
                    });
                  }

                  safeEnqueue({ type: 'text-end', id: currentTextId });
                }
              }

              // Emit finish with final usage
              const usage = await finalResult.usage;
              const finishReason = await finalResult.finishReason;

              safeEnqueue({
                type: 'finish',
                finishReason: finishReason || 'stop',
                totalUsage: {
                  inputTokens: usage?.inputTokens || 0,
                  outputTokens: usage?.outputTokens || 0,
                  totalTokens: usage?.totalTokens || 0,
                },
              });

              safeClose();
              break;
            }

            if (value) {
              // Forward the part as-is, but track state
              // The AI SDK's fullStream returns various stream part types
              const part = value as StreamPart;

              // Track text content - AI SDK uses 'delta' for text-delta events
              switch (part.type) {
              case 'text-delta': 
              case 'text-delta-text': {
                hasSeenText = true;
                // AI SDK fullStream uses 'delta' property, but we'll check both for compatibility
                const delta = typeof part.delta === 'string' ? part.delta : '';
                const text = typeof part.text === 'string' ? part.text : '';
                const textDelta = delta || text;
                if (textDelta) {
                  state.textContent += textDelta;
                }
                if (!currentTextId && typeof part.id === 'string') {
                  currentTextId = part.id;
                }
              
              break;
              }
              case 'text-start': {
                hasSeenText = true;
                if (typeof part.id === 'string') {
                  currentTextId = part.id;
                }
              
              break;
              }
              case 'text-end': {
                currentTextId = null;
              
              break;
              }
              // No default
              }

              // Track tool calls
              if (part.type === 'tool-call') {
                state.toolCalls.push({
                  toolCallId: typeof part.toolCallId === 'string' ? part.toolCallId : '',
                  toolName: typeof part.toolName === 'string' ? part.toolName : '',
                  input: part.input,
                });
              }

              // Track tool results
              if (part.type === 'tool-result') {
                state.toolResults.push({
                  toolCallId: typeof part.toolCallId === 'string' ? part.toolCallId : '',
                  toolName: typeof part.toolName === 'string' ? part.toolName : '',
                  output: part.output,
                });
              }

              // Forward the part immediately - this ensures flow UIs see events in real-time
              safeEnqueue(part as SynthesisStreamPart);
            }
          }
        } catch (error) {
          if (!controllerClosed) {
            controller.error(error);
          }
        }
      },
    });
  };

  // Create lazy-initialized streams
  let enhancedTextStream: ReadableStream<string> | null = null;
  let enhancedFullStream: ReadableStream<SynthesisStreamPart> | null = null;

  // Return enhanced result with our reliable streams
  const enhancedResult = Object.create(
    Object.getPrototypeOf(streamResult),
    Object.getOwnPropertyDescriptors(streamResult),
  ) as typeof streamResult;

  Object.defineProperty(enhancedResult, 'textStream', {
    get: () => {
      if (!enhancedTextStream) {
        enhancedTextStream = createEnhancedTextStream();
      }
      return enhancedTextStream;
    },
    enumerable: true,
  });

  Object.defineProperty(enhancedResult, 'fullStream', {
    get: () => {
      if (!enhancedFullStream) {
        enhancedFullStream = createEnhancedFullStream();
      }
      return enhancedFullStream;
    },
    enumerable: true,
  });

  return enhancedResult;
}
