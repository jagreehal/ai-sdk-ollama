import type { Context } from '@ai-sdk/provider-utils';
import {
  streamText as _streamText,
  stepCountIs,
  type LanguageModelUsage,
  type OutputInterface,
  type StreamTextResult,
  type TextStreamPart,
  type ToolSet,
} from 'ai';
import { addUsage } from '../utils/add-usage';
import {
  buildSynthesisOptions,
  DEFAULT_SYNTHESIS_PROMPT,
  needsSynthesis,
  prepareStepFor,
} from './synthesis';

type AIStreamTextOptions<
  TOOLS extends ToolSet,
  RUNTIME_CONTEXT extends Context,
  OUTPUT extends OutputInterface,
> = Parameters<typeof _streamText<TOOLS, RUNTIME_CONTEXT, OUTPUT>>[0];

type BaseOptions = Parameters<typeof _streamText>[0];
type StreamResult = ReturnType<typeof _streamText>;
type StreamPart = TextStreamPart<ToolSet>;

type Synthesis = {
  /** Includes the separator from any text already streamed. */
  text: string;
  usage: LanguageModelUsage;
  content: Awaited<StreamResult['content']>;
  responseMessages: Awaited<StreamResult['response']>['messages'];
};

/** Streamed text cannot be retracted, so the answer follows any that exists. */
function withSynthesis(text: string, synthesis: Synthesis | undefined) {
  if (!synthesis) return text;
  return text ? text + synthesis.text : synthesis.text.trimStart();
}

function inChunks(text: string, size: number) {
  const chunks: string[] = [];
  for (let index = 0; index < text.length; index += size) {
    chunks.push(text.slice(index, index + size));
  }
  return chunks;
}

/**
 * Like the result's own promises: a getter read but not yet awaited must not
 * become an unhandled rejection when the stream fails.
 */
function markHandled<T>(promise: Promise<T>) {
  promise.catch(() => {});
  return promise;
}

/**
 * Passes `source` through, skipping chunks `keep` rejects, then adds `atEnd()`.
 * It reads `source` to the end whatever the consumer does, so a reader that
 * stops early still gets the run finished and its end callback fired.
 */
function appendAtEnd<T>(
  source: ReadableStream<T>,
  atEnd: () => Promise<T[]>,
  keep: (chunk: T) => boolean = () => true,
  onCancel: () => void = () => {},
) {
  let cancelled = false;

  return new ReadableStream<T>({
    async start(controller) {
      const reader = source.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (keep(value) && !cancelled) controller.enqueue(value);
      }

      const chunks = await atEnd();
      if (cancelled) return;
      for (const chunk of chunks) controller.enqueue(chunk);
      controller.close();
    },
    cancel() {
      cancelled = true;
      onCancel();
    },
  });
}

export type StreamTextOptions<
  TOOLS extends ToolSet = ToolSet,
  RUNTIME_CONTEXT extends Context = Context,
  OUTPUT extends OutputInterface = OutputInterface,
> = AIStreamTextOptions<TOOLS, RUNTIME_CONTEXT, OUTPUT> & {
  enhancedOptions?: {
    /**
     * @deprecated Has no effect.
     */
    enableToolLogging?: boolean;
    /**
     * @default true
     */
    enableStreamingSynthesis?: boolean;
    /**
     * @default 10
     */
    minStreamLength?: number;
    /**
     * @deprecated Has no effect: synthesis needs the finished stream.
     */
    synthesisTimeout?: number;
  };
};

export async function streamText<
  TOOLS extends ToolSet,
  RUNTIME_CONTEXT extends Context = Context,
  OUTPUT extends OutputInterface = OutputInterface<string, string, never>,
>(
  options: StreamTextOptions<TOOLS, RUNTIME_CONTEXT, OUTPUT>,
): Promise<StreamTextResult<ToolSet, RUNTIME_CONTEXT, OUTPUT>>;
// Without this, options typed broadly, such as `activeTools: string[]`, would
// stop compiling once `tools` is concrete.
export async function streamText(
  options: StreamTextOptions,
): Promise<Awaited<ReturnType<typeof _streamText>>>;
export async function streamText(
  options: StreamTextOptions,
): Promise<Awaited<ReturnType<typeof _streamText>>> {
  const { enhancedOptions = {}, ...streamTextOptions } = options;
  const { enableStreamingSynthesis = true, minStreamLength = 10 } =
    enhancedOptions;

  const hasTools = options.tools && Object.keys(options.tools).length > 0;

  if (!hasTools || !enableStreamingSynthesis) {
    return _streamText(streamTextOptions as BaseOptions);
  }

  const { onEnd, onFinish, ...baseOptions } = streamTextOptions as BaseOptions;
  const userOnEnd = onEnd ?? onFinish;

  let enhancedTextStream: ReadableStream<string> | undefined;
  let fullStreamRead = false;
  let readers = 0;
  let synthesis: Promise<Synthesis | undefined> | undefined;
  // Set when nobody can see a synthesized answer, so none is paid for.
  let answerUnread = false;

  // Memoized and keyed off streamResult.steps, which settles on success, error
  // and abort alike, so every reader gets one run and none can hang.
  const getSynthesis = () => {
    synthesis ??= runSynthesis();
    return synthesis;
  };

  // Synthesis is a paid model call, so only a reader of the answer starts it.
  // Usage and the end callback report it if it ran, and never cause it.
  const synthesisIfWanted = async () =>
    (synthesis ?? enhancedTextStream ?? fullStreamRead)
      ? getSynthesis()
      : undefined;

  const wrappedOnEnd: BaseOptions['onEnd'] = async (event) => {
    const finished = await synthesisIfWanted();
    await userOnEnd?.(
      finished
        ? {
            ...event,
            text: withSynthesis(event.text, finished),
            content: [...event.content, ...finished.content],
            responseMessages: [
              ...event.responseMessages,
              ...finished.responseMessages,
            ],
            usage: addUsage(event.usage, finished.usage),
            totalUsage: addUsage(event.totalUsage, finished.usage),
          }
        : event,
    );
  };

  const streamResult = _streamText({
    ...baseOptions,
    stopWhen: baseOptions.stopWhen ?? stepCountIs(5),
    prepareStep: prepareStepFor(baseOptions),
    onEnd: userOnEnd && wrappedOnEnd,
  } as BaseOptions);

  const runSynthesis = async (): Promise<Synthesis | undefined> => {
    if (answerUnread) return undefined;

    let steps: Awaited<typeof streamResult.steps>;
    try {
      steps = await streamResult.steps;
    } catch {
      // The stream failed; result getters and fullStream report that.
      return undefined;
    }

    const streamedText = steps.map((step) => step.text).join('');
    const finalText = steps.at(-1)?.text ?? '';

    // Reading `text` alone has no stream to fill, so it needs real results.
    const hasReader = enhancedTextStream ?? fullStreamRead;
    if (!hasReader && !steps.some((step) => step.toolResults.length > 0)) {
      return undefined;
    }

    // An empty final step has no answer, whatever came before the tool results.
    // Otherwise textStream goes by the length of all it sent, and anything else
    // takes any text as the answer, because a short answer is still an answer.
    if (
      !needsSynthesis({
        steps,
        text: enhancedTextStream && finalText ? streamedText : finalText,
        minLength: enhancedTextStream
          ? minStreamLength
          : Math.min(minStreamLength, 1),
        toolChoice: baseOptions.toolChoice,
      })
    ) {
      return undefined;
    }

    try {
      const synthesisStream = _streamText(
        buildSynthesisOptions(
          baseOptions,
          steps,
          DEFAULT_SYNTHESIS_PROMPT,
        ) as BaseOptions,
      );
      const [text, usage, content, response] = await Promise.all([
        synthesisStream.text,
        synthesisStream.usage,
        synthesisStream.content,
        synthesisStream.response,
      ]);
      return {
        text: streamedText && text ? `\n\n${text}` : text,
        usage,
        content,
        responseMessages: response.messages,
      };
    } catch (error) {
      if (!baseOptions.abortSignal?.aborted) {
        console.warn('🔧 Synthesis failed:', error);
      }
      return undefined;
    }
  };

  const usageWithSynthesis = async () => {
    const usage = await streamResult.usage;
    const finished = await synthesisIfWanted();
    return finished ? addUsage(usage, finished.usage) : usage;
  };

  const textWithSynthesis = async () => {
    const [text, finished] = await Promise.all([
      streamResult.text,
      getSynthesis(),
    ]);
    return withSynthesis(text, finished);
  };

  // An end callback still reports the answer after the last reader has gone.
  const onReaderCancel = () => {
    readers -= 1;
    answerUnread = readers === 0 && !userOnEnd;
  };

  const createEnhancedTextStream = () => {
    readers += 1;
    return appendAtEnd(
      streamResult.textStream,
      async () => {
        const finished = await getSynthesis();
        return inChunks(finished?.text ?? '', 20);
      },
      undefined,
      onReaderCancel,
    );
  };

  const createEnhancedFullStream = () => {
    let finishPart: Extract<StreamPart, { type: 'finish' }> | undefined;
    fullStreamRead = true;
    readers += 1;

    return appendAtEnd(
      streamResult.fullStream,
      async () => {
        const finished = await getSynthesis();
        const parts: StreamPart[] = [];
        if (finished?.text) {
          const id = crypto.randomUUID();
          parts.push(
            { type: 'text-start', id },
            ...inChunks(finished.text, 10).map((text) => ({
              type: 'text-delta' as const,
              id,
              text,
            })),
            { type: 'text-end', id },
          );
        }

        try {
          const totalUsage = await usageWithSynthesis();
          parts.push({
            ...(finishPart ?? {
              type: 'finish',
              finishReason: await streamResult.finishReason,
              rawFinishReason: undefined,
            }),
            totalUsage,
          });
        } catch {
          // A run with no usage has sent its error or abort part, and ends here.
        }
        return parts;
      },
      (part) => {
        // Held back so the one finish part follows any synthesized text.
        if (part.type !== 'finish') return true;
        finishPart = part;
        return false;
      },
      onReaderCancel,
    );
  };

  // The result swaps its internal stream on every tee, and a Proxy reads the
  // current one where a copy's getters reject with "ReadableStream is locked".
  return new Proxy(streamResult, {
    get(target, key) {
      switch (key) {
        case 'textStream': {
          enhancedTextStream ??= createEnhancedTextStream();
          return enhancedTextStream;
        }
        case 'stream':
        case 'fullStream': {
          return createEnhancedFullStream();
        }
        case 'usage':
        case 'totalUsage': {
          return markHandled(usageWithSynthesis());
        }
        case 'text': {
          return markHandled(textWithSynthesis());
        }
        default: {
          // Unbound methods read `stream` and `textStream` through this Proxy,
          // which gives the UI and response helpers the answer. consumeStream
          // only drains the run, so it reads the result's own stream.
          return key === 'consumeStream'
            ? target.consumeStream.bind(target)
            : Reflect.get(target, key);
        }
      }
    },
  });
}
