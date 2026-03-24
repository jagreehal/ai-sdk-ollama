import { streamText as _streamText, stepCountIs } from 'ai';

type AIStreamTextOptions = Parameters<typeof _streamText>[0];

type SynthesisStreamPart =
  | { type: 'text-start'; id: string }
  | { type: 'text-delta'; id: string; text: string; delta?: string }
  | { type: 'text-end'; id: string }
  | { type: 'tool-call'; toolCallId: string; toolName: string; input: unknown }
  | {
      type: 'tool-result';
      toolCallId: string;
      toolName: string;
      output: unknown;
    }
  | {
      type: 'finish';
      finishReason: string;
      totalUsage: {
        inputTokens: number;
        outputTokens: number;
        totalTokens: number;
      };
    }
  | { type: 'start' }
  | { type: 'start-step'; request: unknown; warnings: unknown[] }
  | {
      type: 'finish-step';
      response: unknown;
      usage: unknown;
      finishReason: string;
      providerMetadata: unknown;
    }
  | { type: string; [key: string]: unknown };

type StreamPart = {
  type: string;
  [key: string]: unknown;
};

export type StreamTextOptions = AIStreamTextOptions & {
  enhancedOptions?: {
    /** @default true */
    enableToolLogging?: boolean;
    /** @default true */
    enableStreamingSynthesis?: boolean;
    /** @default 10 */
    minStreamLength?: number;
    /** @default 3000 */
    synthesisTimeout?: number;
  };
};

interface StreamState {
  textContent: string;
  toolCalls: Array<{ toolCallId: string; toolName: string; input: unknown }>;
  toolResults: Array<{ toolCallId: string; toolName: string; output: unknown }>;
  hasFinished: boolean;
  parts: SynthesisStreamPart[];
}

export async function streamText(
  options: StreamTextOptions,
): Promise<Awaited<ReturnType<typeof _streamText>>> {
  const { enhancedOptions = {}, ...streamTextOptions } = options;

  const {
    enableStreamingSynthesis = true,
    minStreamLength = 10,
    synthesisTimeout = 3000,
  } = enhancedOptions;

  const hasTools = options.tools && Object.keys(options.tools).length > 0;

  if (!hasTools || !enableStreamingSynthesis) {
    return _streamText(streamTextOptions as Parameters<typeof _streamText>[0]);
  }

  const streamResult = await _streamText({
    ...(streamTextOptions as Parameters<typeof _streamText>[0]),
    stopWhen:
      streamTextOptions.stopWhen ?? (hasTools ? stepCountIs(5) : undefined),
  });

  const state: StreamState = {
    textContent: '',
    toolCalls: [],
    toolResults: [],
    hasFinished: false,
    parts: [],
  };

  let synthesisApplied = false;
  let synthesisInProgress = false;

  // Generates a synthesis response. Accepts overrides for tool calls/results
  // since state may not be populated when only textStream is consumed.
  const generateSynthesis = async (
    toolCallsOverride?: typeof state.toolCalls,
    toolResultsOverride?: typeof state.toolResults,
  ): Promise<string> => {
    if (synthesisApplied || synthesisInProgress) {
      return '';
    }

    const toolCalls = toolCallsOverride ?? state.toolCalls;
    const toolResults = toolResultsOverride ?? state.toolResults;

    if (toolCalls.length === 0) {
      return '';
    }

    if (state.textContent.length >= minStreamLength) {
      return '';
    }

    synthesisInProgress = true;

    try {
      const toolContext =
        toolResults
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

  // Uses streamResult.steps (not shared state) to detect tool calls,
  // since textStream may be consumed without fullStream populating state.
  const createEnhancedTextStream = () => {
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
              // already closed
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

        const applySynthesisFromSteps = async () => {
          if (synthesisApplied || controllerClosed) return;

          try {
            const steps = await streamResult.steps;
            const allToolCalls: typeof state.toolCalls = [];
            const allToolResults: typeof state.toolResults = [];

            if (steps) {
              for (const step of steps) {
                if (step.toolCalls) {
                  for (const tc of step.toolCalls) {
                    allToolCalls.push({
                      toolCallId: tc.toolCallId,
                      toolName: tc.toolName,
                      input: tc.input,
                    });
                  }
                }
                if (step.toolResults) {
                  for (const tr of step.toolResults) {
                    allToolResults.push({
                      toolCallId: tr.toolCallId,
                      toolName: tr.toolName,
                      output: tr.output,
                    });
                  }
                }
              }
            }

            if (
              allToolCalls.length > 0 &&
              state.textContent.length < minStreamLength
            ) {
              const synthesisText = await generateSynthesis(
                allToolCalls,
                allToolResults,
              );
              if (synthesisText && !controllerClosed) {
                const chunkSize = 20;
                for (let i = 0; i < synthesisText.length; i += chunkSize) {
                  if (!safeEnqueue(synthesisText.slice(i, i + chunkSize)))
                    break;
                }
              }
            }
          } catch {
            // steps not available
          }
        };

        const resetTimeout = () => {
          if (streamTimeout) clearTimeout(streamTimeout);
          streamTimeout = setTimeout(async () => {
            if (!streamComplete && !synthesisApplied && !controllerClosed) {
              await applySynthesisFromSteps();
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
                await applySynthesisFromSteps();
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

  const createEnhancedFullStream = () => {
    const originalFullStream = streamResult.fullStream;

    return new ReadableStream<SynthesisStreamPart>({
      async start(controller) {
        let controllerClosed = false;
        let hasSeenMeaningfulText = false;
        let currentTextId: string | null = null;

        const safeClose = () => {
          if (!controllerClosed) {
            controllerClosed = true;
            try {
              controller.close();
            } catch {
              // already closed
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

              const finalResult = await streamResult;
              const [toolCalls, toolResults, text] = await Promise.all([
                finalResult.toolCalls,
                finalResult.toolResults,
                finalResult.text,
              ]);

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

              if (
                state.toolCalls.length > 0 &&
                state.textContent.length < minStreamLength &&
                !hasSeenMeaningfulText
              ) {
                const synthesisText = await generateSynthesis();
                if (synthesisText && synthesisText.length > 0) {
                  // Emit synthesized text
                  currentTextId = crypto.randomUUID();
                  safeEnqueue({ type: 'text-start', id: currentTextId });

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
              const part = value as StreamPart;

              switch (part.type) {
                case 'text-delta':
                case 'text-delta-text': {
                  const delta =
                    typeof part.delta === 'string' ? part.delta : '';
                  const text = typeof part.text === 'string' ? part.text : '';
                  const textDelta = delta || text;
                  if (textDelta) {
                    state.textContent += textDelta;
                    hasSeenMeaningfulText = true;
                  }
                  if (!currentTextId && typeof part.id === 'string') {
                    currentTextId = part.id;
                  }

                  break;
                }
                case 'text-start': {
                  if (typeof part.id === 'string') {
                    currentTextId = part.id;
                  }

                  break;
                }
                case 'text-end': {
                  currentTextId = null;

                  break;
                }
              }

              if (part.type === 'tool-call') {
                state.toolCalls.push({
                  toolCallId:
                    typeof part.toolCallId === 'string' ? part.toolCallId : '',
                  toolName:
                    typeof part.toolName === 'string' ? part.toolName : '',
                  input: part.input,
                });
              }

              if (part.type === 'tool-result') {
                state.toolResults.push({
                  toolCallId:
                    typeof part.toolCallId === 'string' ? part.toolCallId : '',
                  toolName:
                    typeof part.toolName === 'string' ? part.toolName : '',
                  output: part.output,
                });
              }

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

  let enhancedTextStream: ReadableStream<string> | null = null;
  let enhancedFullStream: ReadableStream<SynthesisStreamPart> | null = null;

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
