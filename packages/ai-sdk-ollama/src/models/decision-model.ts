import {
  UnsupportedFunctionalityError,
  type Experimental_DecisionModelV4 as DecisionModelV4,
  type Experimental_DecisionModelV4Answer as DecisionModelV4Answer,
  type Experimental_DecisionModelV4CallOptions as DecisionModelV4CallOptions,
  type Experimental_DecisionModelV4Input as DecisionModelV4Input,
  type Experimental_DecisionModelV4Question as DecisionModelV4Question,
  type Experimental_DecisionModelV4Result as DecisionModelV4Result,
  type Experimental_DecisionModelV4State as DecisionModelV4State,
  type Experimental_DecisionModelV4StatePart as DecisionModelV4StatePart,
  type JSONValue,
} from '@ai-sdk/provider';
import type {
  SystemOneContent,
  SystemOneQuestion,
  SystemOneRequest,
} from 'ollama';
import type { OllamaClient } from '../ollama-client';
import { OllamaError, rethrowIfAborted } from '../utils/ollama-error';

export interface OllamaDecisionConfig {
  client: OllamaClient;
  provider: string;
}

type Input = DecisionModelV4Input;

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

function toStateValue(part: DecisionModelV4StatePart): JSONValue {
  switch (part.type) {
    case 'text': {
      return part.text;
    }
    case 'json': {
      return part.value;
    }
    case 'file': {
      throw new UnsupportedFunctionalityError({
        functionality: 'file parts in decision state',
      });
    }
  }
}

// A single string or object part goes on the wire as-is; anything else is sent as a list.
function toState(state: DecisionModelV4State): SystemOneContent {
  const values = state.map(toStateValue);
  const [only] = values;
  if (
    values.length === 1 &&
    only != null &&
    typeof only !== 'number' &&
    typeof only !== 'boolean'
  ) {
    return toContent(only);
  }
  return values;
}

function toSystemOneQuestion(
  question: DecisionModelV4Question,
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
 * e.g. `nimble` or `tev1`. Use with the AI SDK's `experimental_decide`.
 * Requires Ollama 0.35+.
 */
export class OllamaDecisionModel implements DecisionModelV4 {
  readonly specificationVersion = 'v4' as const;
  readonly supportedQuestionTypes = ['choice', 'score', 'boolean'] as const;

  constructor(
    readonly modelId: string,
    private readonly config: OllamaDecisionConfig,
  ) {}

  get provider(): string {
    return this.config.provider;
  }

  async doDecide({
    state,
    questions,
    abortSignal,
  }: DecisionModelV4CallOptions): Promise<DecisionModelV4Result> {
    const { client } = this.config;
    if (!client.systemone) {
      throw new OllamaError({
        message:
          'The configured Ollama client does not implement systemone(); decision models need ollama >= 0.6.4 or an adapter that provides it.',
      });
    }

    const request: SystemOneRequest = {
      model: this.modelId,
      state: toState(state),
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

    const answers: Record<string, DecisionModelV4Answer> = {};
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

/** @deprecated Use `OllamaDecisionModel`. */
export const OllamaEvaluationModel = OllamaDecisionModel;
/** @deprecated Use `OllamaDecisionModel`. */
export type OllamaEvaluationModel = OllamaDecisionModel;
