export class OllamaError extends Error {
  readonly cause?: unknown;

  constructor({
    message,
    cause,
  }: {
    message: string;
    cause?: unknown;
  }) {
    super(message);
    this.name = 'OllamaError';
    this.cause = cause;
  }

  static isOllamaError(error: unknown): error is OllamaError {
    return error instanceof OllamaError;
  }
}