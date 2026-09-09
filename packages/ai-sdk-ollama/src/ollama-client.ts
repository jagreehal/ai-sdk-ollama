import type {
  ChatRequest,
  ChatResponse,
  EmbedRequest,
  EmbedResponse,
  WebFetchRequest,
  WebFetchResponse,
  WebSearchRequest,
  WebSearchResponse,
} from 'ollama';

/**
 * A stream of responses that can be cancelled.
 *
 * Structural on purpose: Ollama's own `AbortableAsyncIterator` has private
 * members, so naming that class here would reject every adapter that is not an
 * instance of it. Anything async-iterable with an `abort()` satisfies this.
 */
export interface AbortableStream<T> extends AsyncIterable<T> {
  /** Cancel the in-flight request backing this stream. */
  abort(): void;
}

/** Options supported by the maintained Ollama client adapter. */
export interface OllamaRequestOptions {
  /** Abort only this request. */
  signal?: AbortSignal;
}

/**
 * The subset of the Ollama client used by this provider.
 *
 * Keeping this interface structural lets callers use the official client, a
 * maintained fork, or their own adapter without coupling the provider models
 * to a concrete Ollama class.
 */
export interface OllamaClient {
  chat(
    request: ChatRequest & { stream: true },
    options?: OllamaRequestOptions,
  ): Promise<AbortableStream<ChatResponse>>;
  chat(
    request: ChatRequest & { stream?: false },
    options?: OllamaRequestOptions,
  ): Promise<ChatResponse>;
  embed(
    request: EmbedRequest,
    options?: OllamaRequestOptions,
  ): Promise<EmbedResponse>;
  webSearch(
    request: WebSearchRequest & { timeout?: number },
    options?: OllamaRequestOptions,
  ): Promise<WebSearchResponse>;
  webFetch(
    request: WebFetchRequest & { timeout?: number },
    options?: OllamaRequestOptions,
  ): Promise<WebFetchResponse>;
}
