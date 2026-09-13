import type { SendlibCallOptions, SendlibOptions } from '../types.js';
import {
  createSendlibApiError,
  SendlibAbortError,
  SendlibError,
  SendlibNetworkError,
  SendlibTimeoutError,
  SendlibValidationError,
} from '../errors.js';
import { SENDLIB_DEFAULTS } from './config.js';
import { createRequestHeaders } from './headers.js';
import { executeWithRetry } from './retry.js';

export type SendlibHttpMethod = 'GET' | 'POST';

export interface SendlibTransportRequest extends SendlibCallOptions {
  /** Endpoint family used for stable feature-specific error mapping. */
  readonly feature?: 'batch' | 'email';
  readonly method: SendlibHttpMethod;
  /** SDK-owned endpoint path, for example `/api/send`. */
  readonly path: string;
  /** JSON-compatible request data. Omit for requests without a body. */
  readonly body?: unknown;
}

export type SendlibTransportAbortKind = 'caller' | 'timeout';

/** Internal abort classification consumed by the public error mapper. */
export class SendlibTransportAbortError extends Error {
  readonly kind: SendlibTransportAbortKind;

  constructor(kind: SendlibTransportAbortKind, options?: ErrorOptions) {
    super(kind === 'timeout' ? 'The request timed out.' : 'The request was cancelled.', options);
    this.name = 'SendlibTransportAbortError';
    this.kind = kind;
  }
}

/** Internal response envelope retained until endpoint-specific processing. */
export interface SendlibTransportResponse<T = unknown> {
  readonly body: T;
  readonly headers: Headers;
  readonly ok: boolean;
  readonly status: number;
  readonly statusText: string;
  readonly url: string;
}

/**
 * Resolve an SDK-owned endpoint while retaining an optional proxy path in the
 * configured base URL. Query strings and fragments on the base URL are not
 * endpoint configuration and are intentionally discarded.
 */
export function resolveEndpointUrl(baseUrl: string, endpointPath: string): URL {
  const url = new URL(baseUrl);
  const basePath = url.pathname.endsWith('/') ? url.pathname : `${url.pathname}/`;
  const relativePath = endpointPath.replace(/^\/+/, '');

  url.pathname = `${basePath}${relativePath}`;
  url.search = '';
  url.hash = '';

  return url;
}

function serializeJsonBody(body: unknown): string {
  // Runtime JSON.stringify can return undefined for symbols and functions,
  // despite the broad overload in the platform typings returning `string`.
  const serialized = JSON.stringify(body) as string | undefined;

  if (serialized === undefined) {
    throw new SendlibValidationError('The request body must be JSON-serializable.');
  }

  return serialized;
}

async function parseResponseBody(response: Response): Promise<unknown> {
  const text = await response.text();

  if (text.trim().length === 0) return undefined;

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

interface RequestAbortContext {
  readonly signal: AbortSignal;
  readonly errorIfAborted: (cause?: unknown) => SendlibTransportAbortError | undefined;
  readonly cleanup: () => void;
}

function throwIfAborted(abortContext: RequestAbortContext): void {
  const error = abortContext.errorIfAborted();
  if (error !== undefined) throw error;
}

function mapTransportAbort(error: SendlibTransportAbortError): SendlibError {
  const options = { cause: new Error('The underlying Fetch operation was aborted.') };
  return error.kind === 'timeout'
    ? new SendlibTimeoutError(options)
    : new SendlibAbortError(options);
}

function createRequestAbortContext(
  timeoutMs: number,
  callerSignal: AbortSignal | undefined,
): RequestAbortContext {
  const controller = new AbortController();
  let abortKind: SendlibTransportAbortKind | undefined;
  let timeout: ReturnType<typeof setTimeout> | undefined;

  const abort = (kind: SendlibTransportAbortKind, reason?: unknown): void => {
    if (controller.signal.aborted) return;
    abortKind = kind;
    controller.abort(reason);
  };
  const abortFromCaller = (): void => {
    abort('caller', callerSignal?.reason);
  };

  if (callerSignal?.aborted === true) {
    abortFromCaller();
  } else {
    callerSignal?.addEventListener('abort', abortFromCaller, { once: true });
    timeout = setTimeout(() => {
      abort('timeout');
    }, timeoutMs);
  }

  return {
    signal: controller.signal,
    errorIfAborted(cause?: unknown): SendlibTransportAbortError | undefined {
      return abortKind === undefined
        ? undefined
        : new SendlibTransportAbortError(abortKind, { cause });
    },
    cleanup(): void {
      if (timeout !== undefined) clearTimeout(timeout);
      callerSignal?.removeEventListener('abort', abortFromCaller);
    },
  };
}

/** Execute one SendLib HTTP attempt with endpoint-specific error mapping. */
async function sendlibRequestAttempt<T>(
  options: SendlibOptions,
  request: SendlibTransportRequest,
): Promise<SendlibTransportResponse<T>> {
  const baseUrl = options.baseUrl ?? SENDLIB_DEFAULTS.baseUrl;
  const authMode = options.authMode ?? SENDLIB_DEFAULTS.authMode;
  const fetchImplementation = options.fetch ?? globalThis.fetch;
  const hasJsonBody = request.body !== undefined;
  const timeoutMs = request.timeoutMs ?? options.timeoutMs ?? SENDLIB_DEFAULTS.timeoutMs;
  const abortContext = createRequestAbortContext(timeoutMs, request.signal);

  try {
    throwIfAborted(abortContext);
    const response = await fetchImplementation(resolveEndpointUrl(baseUrl, request.path), {
      method: request.method,
      headers: createRequestHeaders({
        apiKey: options.apiKey,
        authMode,
        hasJsonBody,
      }),
      signal: abortContext.signal,
      ...(hasJsonBody ? { body: serializeJsonBody(request.body) } : {}),
    });
    throwIfAborted(abortContext);
    const body = (await parseResponseBody(response)) as T;
    throwIfAborted(abortContext);

    const result = Object.freeze({
      body,
      headers: new Headers(response.headers),
      ok: response.ok,
      status: response.status,
      statusText: response.statusText,
      url: response.url,
    });

    if (!result.ok) throw createSendlibApiError(result, request.feature);

    return result;
  } catch (error) {
    if (error instanceof SendlibError) throw error;
    const abortError =
      error instanceof SendlibTransportAbortError ? error : abortContext.errorIfAborted(error);
    if (abortError !== undefined) throw mapTransportAbort(abortError);

    throw new SendlibNetworkError({
      cause: new Error('The underlying Fetch implementation failed.'),
    });
  } finally {
    abortContext.cleanup();
  }
}

/** Execute one SendLib request with retries restricted to safe GET operations. */
export async function sendlibRequest<T = unknown>(
  options: SendlibOptions,
  request: SendlibTransportRequest,
): Promise<SendlibTransportResponse<T>> {
  return executeWithRetry(() => sendlibRequestAttempt<T>(options, request), {
    maxRetries: options.maxRetries ?? SENDLIB_DEFAULTS.maxRetries,
    method: request.method,
    ...(request.signal === undefined ? {} : { signal: request.signal }),
  });
}
