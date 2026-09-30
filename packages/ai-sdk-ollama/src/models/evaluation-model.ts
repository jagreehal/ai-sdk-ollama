import type {
  Experimental_EvaluationModelV4 as EvaluationModelV4,
  Experimental_EvaluationModelV4Answer as EvaluationModelV4Answer,
  Experimental_EvaluationModelV4CallOptions as EvaluationModelV4CallOptions,
  Experimental_EvaluationModelV4Input as EvaluationModelV4Input,
  Experimental_EvaluationModelV4Question as EvaluationModelV4Question,
  Experimental_EvaluationModelV4Result as EvaluationModelV4Result,
  JSONValue,
} from '@ai-sdk/provider';
import type {
  SystemOneContent,
  SystemOneQuestion,
  SystemOneRequest,
} from 'ollama';
import type { OllamaClient } from '../ollama-client';
import { OllamaError, rethrowIfAborted } from '../utils/ollama-error';

export interface OllamaEvaluationConfig {
  client: OllamaClient;
  provider: string;
}

type Input = EvaluationModelV4Input;

// `Array.isArray` does not narrow readonly arrays out of a union.
const isList = (input: Input): input is readonly JSONValue[] =>
  Array.isArray(input);
const isText = (input: Input): input is string => typeof input === 'string';

// ollama-js types list content as a mutable array; copy instead of asserting.
const toContent = (input: Input): SystemOneContent =>
  isList(input) ? [...input] : input;

// Criteria descriptions must be strings on the wire (choice also allows null).
const describe = (input: Input): string =>
  isText(input) ? input : JSON.stringify(input);
const describeOptional = (input: Input | null | undefined) =>
  input == null ? undefined : describe(input);

function toSystemOneQuestion(
  question: EvaluationModelV4Question,
): SystemOneQuestion {
  const instructions = toContent(question.instructions);
  switch (question.type) {
    case 'choice': {
      return {
        type: 'choice',
        instructions,
        criteria: Object.fromEntries(
          Object.entries(question.criteria).map(([key, value]) => [
            key,
            value === null ? null : describe(value),
          ]),
        ),
      };
    }
    case 'score': {
      return {
        type: 'score',
        instructions,
        criteria: question.criteria.map(
          (value) => describeOptional(value) ?? '',
        ),
      };
    }
    case 'boolean': {
      return {
        type: 'noul',
        instructions,
        criteria: {
          true: describeOptional(question.criteria?.true),
          false: describeOptional(question.criteria?.false),
        },
      };
    }
  }
}

/**
 * Decision ("System One") model served by Ollama's /v1/systemone endpoint,
 * e.g. `nimble` or `tev1`. Use with the AI SDK's `experimental_evaluate`.
 * Requires Ollama 0.35+.
 */
export class OllamaEvaluationModel implements EvaluationModelV4 {
  readonly specificationVersion = 'v4' as const;
  readonly supportedQuestionTypes = ['choice', 'score', 'boolean'] as const;

  constructor(
    readonly modelId: string,
    private readonly config: OllamaEvaluationConfig,
  ) {}

  get provider(): string {
    return this.config.provider;
  }

  async doEvaluate({
    state,
    questions,
    abortSignal,
  }: EvaluationModelV4CallOptions): Promise<EvaluationModelV4Result> {
    const { client } = this.config;
    if (!client.systemone) {
      throw new OllamaError({
        message:
          'The configured Ollama client does not implement systemone(); evaluation models need ollama >= 0.6.4 or an adapter that provides it.',
      });
    }

    const request: SystemOneRequest = {
      model: this.modelId,
      state: toContent(state),
      questions: Object.fromEntries(
        Object.entries(questions).map(([id, question]) => [
          id,
          toSystemOneQuestion(question),
        ]),
      ),
    };

    const response = await client
      .systemone(request, { signal: abortSignal })
      .catch((error: unknown) => {
        rethrowIfAborted(abortSignal, error);
        throw new OllamaError({
          message: error instanceof Error ? error.message : String(error),
          cause: error,
        });
      });

    const answers: Record<string, EvaluationModelV4Answer> = {};
    const confidence: Record<string, number> = {};
    for (const [id, answer] of Object.entries(response.answers)) {
      switch (answer.type) {
        case 'noul': {
          answers[id] = { type: 'boolean', probability: answer.noul };
          break;
        }
        case 'choice': {
          answers[id] = {
            type: 'choice',
            choice: answer.choice,
            probabilities: answer.probabilities,
          };
          confidence[id] = answer.confidence;
          break;
        }
        case 'score': {
          answers[id] = {
            type: 'score',
            score: answer.score,
            probabilities: answer.probabilities,
          };
          confidence[id] = answer.confidence;
          break;
        }
      }
    }

    return {
      answers,
      usage: {
        inputTokens: response.usage?.input_tokens,
        outputTokens: response.usage?.output_tokens,
      },
      warnings: [],
      providerMetadata: { ollama: { confidence } },
      response: { modelId: response.model, body: response },
    };
  }
}
