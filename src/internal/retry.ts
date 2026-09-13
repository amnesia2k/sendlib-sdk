import {
  SendlibAbortError,
  SendlibApiError,
  SendlibNetworkError,
  SendlibRateLimitError,
} from '../errors.js';
import type { SendlibHttpMethod } from './transport.js';

const INITIAL_BACKOFF_MS = 250;
const MAX_BACKOFF_MS = 10_000;
const RETRYABLE_SERVER_STATUSES = new Set([500, 502, 503, 504]);

export interface RetryPolicy {
  readonly maxRetries: number;
  readonly method: SendlibHttpMethod;
  readonly signal?: AbortSignal;
}

export interface RetryDependencies {
  readonly random?: () => number;
  readonly sleep?: (milliseconds: number, signal?: AbortSignal) => Promise<void>;
}

function defaultSleep(milliseconds: number, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted === true) return Promise.reject(new SendlibAbortError());

  return new Promise((resolve, reject) => {
    const onAbort = (): void => {
      clearTimeout(timeout);
      signal?.removeEventListener('abort', onAbort);
      reject(new SendlibAbortError());
    };
    const timeout = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, milliseconds);

    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

function isRetryable(error: unknown, method: SendlibHttpMethod): boolean {
  if (method !== 'GET') return false;
  if (error instanceof SendlibNetworkError || error instanceof SendlibRateLimitError) return true;
  return error instanceof SendlibApiError && RETRYABLE_SERVER_STATUSES.has(error.status);
}

function retryDelay(error: unknown, retryIndex: number, random: () => number): number {
  if (error instanceof SendlibRateLimitError && error.retryAfterMs !== undefined) {
    return error.retryAfterMs;
  }

  const ceiling = Math.min(INITIAL_BACKOFF_MS * 2 ** retryIndex, MAX_BACKOFF_MS);
  return Math.floor(random() * ceiling);
}

/** Execute an operation with retries restricted to requests known to be safe. */
export async function executeWithRetry<T>(
  operation: (attempt: number) => Promise<T>,
  policy: RetryPolicy,
  dependencies: RetryDependencies = {},
): Promise<T> {
  const random = dependencies.random ?? Math.random;
  const sleep = dependencies.sleep ?? defaultSleep;

  for (let attempt = 0; ; attempt += 1) {
    try {
      return await operation(attempt);
    } catch (error) {
      if (attempt >= policy.maxRetries || !isRetryable(error, policy.method)) throw error;
      await sleep(retryDelay(error, attempt, random), policy.signal);
    }
  }
}
