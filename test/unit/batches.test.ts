import { describe, expect, it, vi } from 'vitest';

import {
  Sendlib,
  SendlibAbortError,
  SendlibBatchFailedError,
  SendlibBatchWaitTimeoutError,
  SendlibPlanRequiredError,
  SendlibValidationError,
} from '../../src/index.js';
import type { BatchStatusResponse, SendlibFetch } from '../../src/index.js';

interface CapturedRequest {
  readonly input: unknown;
  readonly init?: RequestInit;
}

interface FakeResponse {
  readonly body: unknown;
  readonly headers?: ConstructorParameters<typeof Headers>[0];
  readonly status?: number;
}

function batchStatus(
  status: BatchStatusResponse['status'],
  overrides: Partial<BatchStatusResponse> = {},
): BatchStatusResponse {
  return {
    success: true,
    batchId: 'batch-123',
    status,
    total: 2,
    sent: status === 'done' ? 2 : 1,
    failed: 0,
    progress: status === 'done' ? 100 : 50,
    recipients: [],
    ...overrides,
  };
}

function fakeClient(...responses: readonly FakeResponse[]): {
  readonly client: Sendlib;
  readonly requests: CapturedRequest[];
} {
  const queue = [...responses];
  const requests: CapturedRequest[] = [];
  const fetch: SendlibFetch = (input, init) => {
    requests.push({ input, ...(init === undefined ? {} : { init }) });
    const next = queue.shift();
    if (next === undefined) return Promise.reject(new Error('No fake response remains'));
    const body = typeof next.body === 'string' ? next.body : JSON.stringify(next.body);
    return Promise.resolve(
      new Response(body, {
        ...(next.headers === undefined ? {} : { headers: next.headers }),
        status: next.status ?? 200,
      }),
    );
  };

  return { client: new Sendlib({ apiKey: 'batch-test-key', fetch }), requests };
}

function onlyRequest(requests: readonly CapturedRequest[]): CapturedRequest {
  expect(requests).toHaveLength(1);
  const request = requests[0];
  if (request === undefined) throw new Error('Expected one request');
  return request;
}

function requestBody(request: CapturedRequest): unknown {
  const body = request.init?.body;
  if (typeof body !== 'string') throw new Error('Expected a JSON request body');
  return JSON.parse(body) as unknown;
}

describe('batches.create', () => {
  it('sends the exact documented Pro batch payload and preserves the 202 response', async () => {
    const response = { success: true, batchId: 'batch-123', total: 2, status: 'queued' } as const;
    const { client, requests } = fakeClient({ body: response, status: 202 });
    const input = {
      from: '"Operations" <ops@example.test>',
      subject: 'Hello {{name}}',
      recipients: [
        { email: 'one@example.test', variables: { name: 'One', count: 1 } },
        { email: 'two@example.test', variables: { name: 'Two', active: true } },
      ],
      html: '<p>Hello {{name}}</p>',
      text: 'Hello {{name}}',
      replyTo: 'support@example.test',
    } as const;

    await expect(client.batches.create(input)).resolves.toEqual(response);

    const request = onlyRequest(requests);
    expect(String(request.input)).toBe('https://sendlib.samueltuoyo.com/api/batch');
    expect(request.init?.method).toBe('POST');
    expect(requestBody(request)).toEqual(input);
  });

  it('allow-lists batch and recipient fields', async () => {
    const { client, requests } = fakeClient({
      body: { success: true, batchId: 'batch-123', total: 1, status: 'queued' },
      status: 202,
    });
    const input = {
      from: 'ops@example.test',
      subject: 'Notice',
      recipients: [{ email: 'one@example.test', runtimeOnly: 'omit' }],
      text: 'Notice',
      runtimeOnly: 'omit',
    };

    await client.batches.create(input);

    expect(requestBody(onlyRequest(requests))).toEqual({
      from: 'ops@example.test',
      subject: 'Notice',
      recipients: [{ email: 'one@example.test' }],
      text: 'Notice',
    });
  });

  it('supports an HTML-only payload and forwards per-call controls', async () => {
    const { client, requests } = fakeClient({
      body: { success: true, batchId: 'batch-123', total: 1, status: 'queued' },
      status: 202,
    });
    const signal = new AbortController().signal;

    await client.batches.create(
      {
        from: 'ops@example.test',
        subject: 'Notice',
        recipients: [{ email: 'one@example.test' }],
        html: '<p>Notice</p>',
      },
      { signal, timeoutMs: 1_000 },
    );

    expect(requestBody(onlyRequest(requests))).toEqual({
      from: 'ops@example.test',
      subject: 'Notice',
      recipients: [{ email: 'one@example.test' }],
      html: '<p>Notice</p>',
    });
  });

  it('rejects invalid inputs and attachments before Fetch', async () => {
    const { client, requests } = fakeClient();

    await expect(
      client.batches.create({
        from: 'ops@example.test',
        subject: 'Notice',
        recipients: [{ email: 'one@example.test' }],
        text: 'Notice',
        attachments: [] as never,
      }),
    ).rejects.toBeInstanceOf(SendlibValidationError);
    await expect(
      client.batches.create(
        {
          from: 'ops@example.test',
          subject: 'Notice',
          recipients: [{ email: 'one@example.test' }],
          text: 'Notice',
        },
        { timeoutMs: -1 },
      ),
    ).rejects.toBeInstanceOf(SendlibValidationError);
    expect(requests).toHaveLength(0);
  });

  it.each([
    [{ error: 'plan' }, { error: 'plan' }],
    ['Free plan', 'Free plan'],
    ['{broken', '{broken'],
    ['', undefined],
  ])('maps every batch 403 body form to the stable plan error', async (body, expectedBody) => {
    const { client, requests } = fakeClient({ body, status: 403 });

    try {
      await client.batches.create({
        from: 'ops@example.test',
        subject: 'Notice',
        recipients: [{ email: 'one@example.test' }],
        text: 'Notice',
      });
      expect.unreachable('Expected a plan error');
    } catch (error: unknown) {
      expect(error).toBeInstanceOf(SendlibPlanRequiredError);
      if (!(error instanceof SendlibPlanRequiredError)) throw error;
      expect(error).toMatchObject({ feature: 'batch', requiredPlan: 'pro', status: 403 });
      expect(error.body).toEqual(expectedBody);
    }
    expect(requests).toHaveLength(1);
  });
});

describe('batches.retrieve', () => {
  it('encodes the ID and preserves documented and forward-compatible recipient data', async () => {
    const response = batchStatus('processing', {
      recipients: [
        { email: 'one@example.test', status: 'sent', messageId: 'message-1', error: null },
        { email: 'two@example.test', status: 'pending', messageId: null, error: null },
        {
          email: 'three@example.test',
          status: 'future-status',
          messageId: null,
          error: { future: true },
        },
      ],
    });
    const { client, requests } = fakeClient({ body: response });

    await expect(client.batches.retrieve('batch/id ?#')).resolves.toEqual(response);

    const request = onlyRequest(requests);
    expect(String(request.input)).toBe(
      'https://sendlib.samueltuoyo.com/api/batch/batch%2Fid%20%3F%23',
    );
    expect(request.init?.method).toBe('GET');
    expect(request.init?.body).toBeUndefined();
  });

  it('validates the ID and call options before Fetch', async () => {
    const { client, requests } = fakeClient();

    await expect(client.batches.retrieve('')).rejects.toBeInstanceOf(SendlibValidationError);
    await expect(client.batches.retrieve('batch-1', { timeoutMs: -1 })).rejects.toBeInstanceOf(
      SendlibValidationError,
    );
    expect(requests).toHaveLength(0);
  });
});

describe('batches.wait', () => {
  it('continues through queued and processing, then returns done without creating a batch', async () => {
    const { client, requests } = fakeClient(
      { body: batchStatus('queued') },
      { body: batchStatus('processing') },
      { body: batchStatus('done') },
    );

    await expect(
      client.batches.wait('batch-123', { intervalMs: 1, timeoutMs: 1_000 }),
    ).resolves.toMatchObject({
      status: 'done',
    });

    expect(requests).toHaveLength(3);
    expect(requests.every((request) => request.init?.method === 'GET')).toBe(true);
  });

  it('throws a redaction-safe error for the terminal failed state', async () => {
    const failed = batchStatus('failed', {
      recipients: [
        { email: 'private@example.test', status: 'failed', messageId: null, error: 'private' },
      ],
    });
    const { client } = fakeClient({ body: failed });

    try {
      await client.batches.wait('batch-123');
      expect.unreachable('Expected batch failure');
    } catch (error: unknown) {
      expect(error).toBeInstanceOf(SendlibBatchFailedError);
      if (!(error instanceof SendlibBatchFailedError)) throw error;
      expect(error.response).toEqual(failed);
      expect(JSON.stringify(error)).not.toContain('private@example.test');
    }
  });

  it('returns a daily-limit pause by default', async () => {
    const { client, requests } = fakeClient({ body: batchStatus('paused_limit_reached') });

    await expect(client.batches.wait('batch-123')).resolves.toMatchObject({
      status: 'paused_limit_reached',
    });
    expect(requests).toHaveLength(1);
  });

  it('can continue after a daily-limit pause when explicitly requested', async () => {
    const { client, requests } = fakeClient(
      { body: batchStatus('paused_limit_reached') },
      { body: batchStatus('done') },
    );

    await expect(
      client.batches.wait('batch-123', {
        intervalMs: 1,
        returnOnPausedLimit: false,
        timeoutMs: 1_000,
      }),
    ).resolves.toMatchObject({ status: 'done' });
    expect(requests).toHaveLength(2);
  });

  it('honors the overall timeout before issuing a request', async () => {
    const { client, requests } = fakeClient();

    await expect(client.batches.wait('batch-123', { timeoutMs: 0 })).rejects.toMatchObject({
      batchId: 'batch-123',
      name: 'SendlibBatchWaitTimeoutError',
      timeoutMs: 0,
    });
    expect(requests).toHaveLength(0);
  });

  it('checks the deadline before each retrieval', async () => {
    vi.spyOn(Date, 'now').mockReturnValueOnce(0).mockReturnValueOnce(11);
    const { client, requests } = fakeClient();

    await expect(client.batches.wait('batch-123', { timeoutMs: 10 })).rejects.toBeInstanceOf(
      SendlibBatchWaitTimeoutError,
    );
    expect(requests).toHaveLength(0);
  });

  it('checks the deadline again before sleeping', async () => {
    vi.spyOn(Date, 'now').mockReturnValueOnce(0).mockReturnValueOnce(0).mockReturnValueOnce(11);
    const { client, requests } = fakeClient({ body: batchStatus('processing') });

    await expect(client.batches.wait('batch-123', { timeoutMs: 10 })).rejects.toBeInstanceOf(
      SendlibBatchWaitTimeoutError,
    );
    expect(requests).toHaveLength(1);
  });

  it('aborts polling delay when the overall deadline expires', async () => {
    vi.useFakeTimers();
    try {
      const { client } = fakeClient({ body: batchStatus('processing') });
      const result = expect(
        client.batches.wait('batch-123', { intervalMs: 100, timeoutMs: 5 }),
      ).rejects.toBeInstanceOf(SendlibBatchWaitTimeoutError);

      await vi.advanceTimersByTimeAsync(5);
      await result;
    } finally {
      vi.useRealTimers();
    }
  });

  it('honors an already-aborted caller signal without Fetch', async () => {
    const controller = new AbortController();
    controller.abort();
    const { client, requests } = fakeClient();

    await expect(
      client.batches.wait('batch-123', { signal: controller.signal }),
    ).rejects.toBeInstanceOf(SendlibAbortError);
    await expect(
      client.batches.wait('batch-123', { signal: controller.signal, timeoutMs: 0 }),
    ).rejects.toBeInstanceOf(SendlibAbortError);
    expect(requests).toHaveLength(0);
  });

  it('honors caller cancellation during an active retrieval', async () => {
    const controller = new AbortController();
    const fetch: SendlibFetch = (_input, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener(
          'abort',
          () => {
            setTimeout(() => {
              reject(new Error('aborted'));
            }, 10);
          },
          { once: true },
        );
      });
    const client = new Sendlib({ apiKey: 'batch-test-key', fetch });
    setTimeout(() => {
      controller.abort();
    }, 1);

    await expect(
      client.batches.wait('batch-123', { signal: controller.signal, timeoutMs: 5 }),
    ).rejects.toBeInstanceOf(SendlibAbortError);
  });

  it('uses bounded GET retries for rate limits and transient server failures', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const { client, requests } = fakeClient(
      { body: { error: 'rate' }, headers: { 'Retry-After': '0' }, status: 429 },
      { body: { error: 'temporary' }, status: 503 },
      { body: batchStatus('done') },
    );

    await expect(client.batches.wait('batch-123', { timeoutMs: 1_000 })).resolves.toMatchObject({
      status: 'done',
    });
    expect(requests).toHaveLength(3);
    expect(requests.every((request) => request.init?.method === 'GET')).toBe(true);
  });

  it('validates polling options before Fetch', async () => {
    const { client, requests } = fakeClient();

    await expect(client.batches.wait('', { intervalMs: 1 })).rejects.toBeInstanceOf(
      SendlibValidationError,
    );
    await expect(client.batches.wait('batch-123', { intervalMs: 0 })).rejects.toBeInstanceOf(
      SendlibValidationError,
    );
    expect(requests).toHaveLength(0);
  });
});
