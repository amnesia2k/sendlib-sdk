import type { SendlibCallOptions, SendlibFetch, SendlibOptions } from '../../src/index.js';

export const fetchImplementation: SendlibFetch = () =>
  Promise.resolve(new Response(null, { status: 204 }));

export const minimalOptions = {
  apiKey: 'test-only-api-key',
} satisfies SendlibOptions;

export const completeOptions = {
  apiKey: 'test-only-api-key',
  authMode: 'x-api-key',
  baseUrl: 'https://example.test',
  fetch: fetchImplementation,
  maxRetries: 0,
  timeoutMs: 1_000,
} satisfies SendlibOptions;

export const invalidAuthMode: SendlibOptions = {
  apiKey: 'test-only-api-key',
  // @ts-expect-error Only documented SendLib authentication modes are accepted.
  authMode: 'basic',
};

export const callOptions: SendlibCallOptions = {
  signal: new AbortController().signal,
  timeoutMs: 5_000,
};

export const invalidCallOptions: SendlibCallOptions = {
  // @ts-expect-error Per-call timeouts must be numbers.
  timeoutMs: '5000',
};
