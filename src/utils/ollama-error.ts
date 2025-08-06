export interface OllamaErrorData {
  message: string;
  code?: string;
  details?: unknown;
}

export class OllamaError extends Error {
  readonly cause?: unknown;
  readonly data?: OllamaErrorData;

  constructor({
    message,
    cause,
    data,
  }: {
    message: string;
    cause?: unknown;
    data?: OllamaErrorData;
  }) {
    super(message);
    this.name = 'OllamaError';
    this.cause = cause;
    this.data = data;
  }

  static isOllamaError(error: unknown): error is OllamaError {
    return error instanceof OllamaError;
  }
}
