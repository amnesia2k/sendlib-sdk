import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  SendlibAbortError,
  SendlibApiError,
  SendlibError,
  SendlibNetworkError,
  SendlibPlanRequiredError,
} from '../../src/errors.js';
import { resolveEndpointUrl, sendlibRequest } from '../../src/internal/transport.js';

const apiKey = 'test-only-api-key';

function createFetch(response: Response): typeof fetch {
  return vi.fn(() => Promise.resolve(response));
}

function createPendingAbortAwareFetch(): typeof fetch {
  return vi.fn(
    (_input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) =>
      new Promise<Response>((_resolve, reject) => {
        const signal = init?.signal;

        if (signal === undefined || signal === null) {
          reject(new Error('Expected the transport to provide an AbortSignal'));
          return;
        }

        const rejectOnAbort = (): void => {
          reject(new DOMException('The operation was aborted.', 'AbortError'));
        };

        if (signal.aborted) rejectOnAbort();
        else signal.addEventListener('abort', rejectOnAbort, { once: true });
      }),
  );
}

async function captureSendlibError(promise: Promise<unknown>): Promise<SendlibError> {
  const result = await promise.then(
    () => undefined,
    (error: unknown) => error,
  );

  if (!(result instanceof SendlibError)) {
    throw new TypeError('Expected the request to reject with a SendlibError');
  }

  return result;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('resolveEndpointUrl', () => {
  it('resolves a leading-slash endpoint against an origin', () => {
    expect(resolveEndpointUrl('https://example.test', '/api/send').href).toBe(
      'https://example.test/api/send',
    );
  });

  it('retains a trailing-slash proxy path and discards base query and fragment data', () => {
    expect(
      resolveEndpointUrl('http://localhost:3000/proxy/?ignored=true#fragment', 'api/batch').href,
    ).toBe('http://localhost:3000/proxy/api/batch');
  });
});

describe('sendlibRequest', () => {
  it('uses an injected fetch implementation and serializes JSON predictably', async () => {
    const fetchImplementation = createFetch(
      new Response(JSON.stringify({ success: true }), {
        headers: { 'x-request-id': 'request-123' },
        status: 202,
        statusText: 'Accepted',
      }),
    );
    const requestBody = { subject: 'Account update', nested: { enabled: true } };
    const caller = new AbortController();
    const addEventListener = vi.spyOn(caller.signal, 'addEventListener');
    const removeEventListener = vi.spyOn(caller.signal, 'removeEventListener');

    const result = await sendlibRequest(
      {
        apiKey,
        authMode: 'x-api-key',
        baseUrl: 'https://proxy.example.test/sendlib',
        fetch: fetchImplementation,
      },
      { method: 'POST', path: '/api/send', body: requestBody, signal: caller.signal },
    );

    expect(fetchImplementation).toHaveBeenCalledOnce();
    const [url, init] = vi.mocked(fetchImplementation).mock.calls[0] ?? [];
    expect(url).toBeInstanceOf(URL);
    expect((url as URL).href).toBe('https://proxy.example.test/sendlib/api/send');
    expect(init?.method).toBe('POST');
    expect(init?.body).toBe(JSON.stringify(requestBody));
    expect(Object.fromEntries(new Headers(init?.headers))).toEqual({
      accept: 'application/json',
      'content-type': 'application/json',
      'x-api-key': apiKey,
    });
    expect(result.body).toEqual({ success: true });
    expect(result.ok).toBe(true);
    expect(result.status).toBe(202);
    expect(result.statusText).toBe('Accepted');
    expect(result.url).toBe('');
    expect(result.headers.get('x-request-id')).toBe('request-123');
    expect(Object.isFrozen(result)).toBe(true);
    expect(addEventListener).toHaveBeenCalledWith('abort', expect.any(Function), { once: true });
    expect(removeEventListener).toHaveBeenCalledWith('abort', expect.any(Function));
  });

  it('uses platform fetch and default URL/authentication for a bodyless request', async () => {
    const fetchImplementation = createFetch(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchImplementation);

    const result = await sendlibRequest({ apiKey }, { method: 'GET', path: '/api/batch/test-id' });

    const [url, init] = vi.mocked(fetchImplementation).mock.calls[0] ?? [];
    expect(url).toBeInstanceOf(URL);
    expect((url as URL).href).toBe('https://sendlib.samueltuoyo.com/api/batch/test-id');
    expect(init?.body).toBeUndefined();
    expect(Object.fromEntries(new Headers(init?.headers))).toEqual({
      accept: 'application/json',
      authorization: `Bearer ${apiKey}`,
    });
    expect(result.body).toBeUndefined();
    expect(result.status).toBe(204);
  });

  it.each([
    ['plain text', 'upstream text'],
    ['malformed JSON', '{"incomplete":'],
    ['JSON array', '[1,2,3]'],
    ['JSON primitive', 'true'],
    ['whitespace', '   \n  '],
  ])('handles a %s response without an unrelated parsing error', async (_, responseBody) => {
    const error = await captureSendlibError(
      sendlibRequest(
        { apiKey, fetch: createFetch(new Response(responseBody, { status: 418 })) },
        { method: 'GET', path: '/api/test' },
      ),
    );

    expect(error).toBeInstanceOf(SendlibApiError);
    if (!(error instanceof SendlibApiError)) throw new TypeError('Expected an API error');
    if (responseBody === '[1,2,3]') expect(error.body).toEqual([1, 2, 3]);
    else if (responseBody === 'true') expect(error.body).toBe(true);
    else if (responseBody.trim().length === 0) expect(error.body).toBeUndefined();
    else expect(error.body).toBe(responseBody);
    expect(error.status).toBe(418);
  });

  it('rejects a body that JSON.stringify cannot represent', async () => {
    const fetchImplementation = createFetch(new Response());

    await expect(
      sendlibRequest(
        { apiKey, fetch: fetchImplementation },
        { method: 'POST', path: '/api/send', body: Symbol('not-json') },
      ),
    ).rejects.toMatchObject({
      message: 'The request body must be JSON-serializable.',
      name: 'SendlibValidationError',
    });
    expect(fetchImplementation).not.toHaveBeenCalled();
  });

  it('rejects an already-cancelled call before invoking fetch', async () => {
    const caller = new AbortController();
    const fetchImplementation = createFetch(new Response());
    caller.abort('test cancellation');

    await expect(
      sendlibRequest(
        { apiKey, fetch: fetchImplementation },
        { method: 'GET', path: '/api/test', signal: caller.signal },
      ),
    ).rejects.toMatchObject({
      message: 'The SendLib request was cancelled.',
      name: 'SendlibAbortError',
    });
    await expect(
      sendlibRequest(
        { apiKey, fetch: fetchImplementation },
        { method: 'GET', path: '/api/test', signal: caller.signal },
      ),
    ).rejects.toBeInstanceOf(SendlibAbortError);
    expect(fetchImplementation).not.toHaveBeenCalled();
  });

  it('classifies cancellation during fetch as caller initiated', async () => {
    const caller = new AbortController();
    const request = sendlibRequest(
      { apiKey, fetch: createPendingAbortAwareFetch() },
      { method: 'GET', path: '/api/test', signal: caller.signal },
    );
    const rejection = expect(request).rejects.toMatchObject({
      message: 'The SendLib request was cancelled.',
      name: 'SendlibAbortError',
    });

    caller.abort();

    await rejection;
  });

  it('uses a per-call timeout override and classifies the timeout', async () => {
    vi.useFakeTimers();

    try {
      const request = sendlibRequest(
        { apiKey, fetch: createPendingAbortAwareFetch(), timeoutMs: 60_000 },
        { method: 'GET', path: '/api/test', timeoutMs: 25 },
      );
      const rejection = expect(request).rejects.toMatchObject({
        message: 'The SendLib request timed out.',
        name: 'SendlibTimeoutError',
      });

      await vi.advanceTimersByTimeAsync(25);

      await rejection;
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it('keeps the first abort classification when timeout and caller cancellation race', async () => {
    vi.useFakeTimers();

    try {
      const caller = new AbortController();
      let resolveFetch: ((response: Response) => void) | undefined;
      const fetchImplementation: typeof fetch = vi.fn(
        () =>
          new Promise<Response>((resolve) => {
            resolveFetch = resolve;
          }),
      );
      const request = sendlibRequest(
        { apiKey, fetch: fetchImplementation, timeoutMs: 10 },
        { method: 'GET', path: '/api/test', signal: caller.signal },
      );
      const rejection = expect(request).rejects.toBeInstanceOf(SendlibAbortError);

      caller.abort();
      await vi.advanceTimersByTimeAsync(10);
      resolveFetch?.(new Response());

      await rejection;
    } finally {
      vi.useRealTimers();
    }
  });

  it('maps a non-abort fetch failure to a network error', async () => {
    const networkFailure = new TypeError('synthetic network failure');
    const fetchImplementation: typeof fetch = vi.fn(() => Promise.reject(networkFailure));

    await expect(
      sendlibRequest({ apiKey, fetch: fetchImplementation }, { method: 'GET', path: '/api/test' }),
    ).rejects.toMatchObject({
      message: 'Unable to reach SendLib.',
      name: 'SendlibNetworkError',
    });
    await expect(
      sendlibRequest({ apiKey, fetch: fetchImplementation }, { method: 'GET', path: '/api/test' }),
    ).rejects.toBeInstanceOf(SendlibNetworkError);
  });

  it.each([
    ['object', JSON.stringify({ message: 'SECRET_API_KEY marker' })],
    ['text', 'SECRET_API_KEY text'],
    ['malformed JSON', '{"SECRET_API_KEY":'],
    ['empty', null],
  ])('maps a batch 403 with a %s body to one safe plan error', async (_, responseBody) => {
    const secret = 'SECRET_API_KEY';
    const fetchImplementation = createFetch(new Response(responseBody, { status: 403 }));
    const error = await captureSendlibError(
      sendlibRequest(
        { apiKey: secret, fetch: fetchImplementation },
        { feature: 'batch', method: 'POST', path: '/api/batch', body: { recipients: ['private'] } },
      ),
    );

    expect(error).toBeInstanceOf(SendlibPlanRequiredError);
    expect(error).toMatchObject({
      feature: 'batch',
      message: 'Batch sending requires a SendLib Pro plan.',
      requiredPlan: 'pro',
      status: 403,
    });
    expect(String(error)).not.toContain(secret);
    expect(error.stack).not.toContain(secret);
    expect(JSON.stringify(error)).not.toContain(secret);
    expect(fetchImplementation).toHaveBeenCalledOnce();
  });

  it('redacts a secret-bearing failure from public network-error surfaces', async () => {
    const secret = 'RECOGNIZABLE_FAKE_SECRET';
    const fetchImplementation: typeof fetch = vi.fn(() =>
      Promise.reject(new Error(`Authorization: Bearer ${secret}`)),
    );
    const error = await captureSendlibError(
      sendlibRequest(
        { apiKey: secret, fetch: fetchImplementation, maxRetries: 0 },
        { method: 'GET', path: '/api/test' },
      ),
    );

    expect(error).toBeInstanceOf(SendlibNetworkError);
    expect(String(error)).not.toContain(secret);
    expect(error.stack).not.toContain(secret);
    expect(String(error.cause)).not.toContain(secret);
    expect(JSON.stringify(error)).not.toContain(secret);
  });

  it('never retries an email-creating POST after a server failure', async () => {
    const fetchImplementation = createFetch(new Response('failure', { status: 500 }));

    await expect(
      sendlibRequest(
        { apiKey, fetch: fetchImplementation, maxRetries: 5 },
        { feature: 'email', method: 'POST', path: '/api/send', body: { html: '<p>Body</p>' } },
      ),
    ).rejects.toBeInstanceOf(SendlibApiError);
    expect(fetchImplementation).toHaveBeenCalledOnce();
  });

  it('retries a safe GET after a selected transient server response', async () => {
    const random = vi.spyOn(Math, 'random').mockReturnValue(0);
    const fetchImplementation: typeof fetch = vi
      .fn<() => Promise<Response>>()
      .mockResolvedValueOnce(new Response('temporary', { status: 503 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ status: 'done' }), { status: 200 }));

    const result = await sendlibRequest(
      { apiKey, fetch: fetchImplementation, maxRetries: 1 },
      { feature: 'batch', method: 'GET', path: '/api/batch/test-id' },
    );

    expect(result.body).toEqual({ status: 'done' });
    expect(fetchImplementation).toHaveBeenCalledTimes(2);
    expect(random).toHaveBeenCalledOnce();
  });
});
