import { describe, expect, it } from 'vitest';

import {
  Sendlib,
  SendlibApiError,
  SendlibAuthenticationError,
  SendlibConfigError,
  SendlibForbiddenError,
  SendlibPayloadTooLargeError,
  SendlibRateLimitError,
  SendlibValidationError,
} from '../../src/index.js';
import type { SendlibFetch, SendlibOptions } from '../../src/index.js';

interface CapturedRequest {
  readonly input: unknown;
  readonly init?: RequestInit;
}

function fakeClient(
  response: unknown = { success: true },
  responseInit: ResponseInit = { status: 200 },
): { client: Sendlib; requests: CapturedRequest[] } {
  const requests: CapturedRequest[] = [];
  const fetch: SendlibFetch = (input, init) => {
    requests.push({ input, ...(init === undefined ? {} : { init }) });
    const body = typeof response === 'string' ? response : JSON.stringify(response);
    return Promise.resolve(new Response(body, responseInit));
  };

  return {
    client: new Sendlib({ apiKey: 'phase-4-test-key', fetch }),
    requests,
  };
}

function parsedBody(request: CapturedRequest): unknown {
  const body = request.init?.body;
  if (typeof body !== 'string') throw new TypeError('Expected a string request body');
  return JSON.parse(body) as unknown;
}

function onlyRequest(requests: readonly CapturedRequest[]): CapturedRequest {
  expect(requests).toHaveLength(1);
  const request = requests[0];
  if (request === undefined) throw new Error('Expected one captured request');
  return request;
}

describe('Sendlib client', () => {
  it('rejects invalid configuration with the public configuration error', () => {
    expect(() => new Sendlib({ apiKey: '' })).toThrow(SendlibConfigError);
    try {
      new Sendlib({ apiKey: '' });
    } catch (error) {
      expect(error).toMatchObject({ message: 'options.apiKey must be a non-empty string' });
      expect((error as Error).cause).toBeInstanceOf(TypeError);
    }
  });

  it('copies configuration and exposes frozen resource namespaces', async () => {
    const requests: CapturedRequest[] = [];
    const fetch: SendlibFetch = (input, init) => {
      requests.push({ input, ...(init === undefined ? {} : { init }) });
      return Promise.resolve(Response.json({ accepted: true }));
    };
    const mutableOptions: SendlibOptions = { apiKey: 'original-key', fetch };
    const client = new Sendlib(mutableOptions);
    (mutableOptions as { apiKey: string }).apiKey = 'changed-key';

    await client.emails.send({ to: 'person@example.test', subject: 'Hello', html: '<p>Hi</p>' });

    expect(requests[0]?.init?.headers).toEqual(
      new Headers({
        Accept: 'application/json',
        Authorization: 'Bearer original-key',
        'Content-Type': 'application/json',
      }),
    );
    expect(Object.isFrozen(client.emails)).toBe(true);
    expect(Object.isFrozen(client.batches)).toBe(true);
    expect(Object.isFrozen(client.templates)).toBe(true);
    expect(Object.isFrozen(client.deliverability)).toBe(true);
  });

  it('provides the non-blocking deliverability analyzer as a thin alias', () => {
    const { client } = fakeClient();
    const input = { to: 'person@example.test', subject: 'Hello', html: '<p>Hi</p>' } as const;

    const report = client.deliverability.analyze(input);
    expect(Array.isArray(report.issues)).toBe(true);
    expect(Array.isArray(report.manualChecks)).toBe(true);
    expect(typeof report.passedAutomatedChecks).toBe('boolean');
  });
});

describe('emails.send', () => {
  it('sends the exact minimal custom HTML request and returns the upstream body', async () => {
    const response = { accepted: true, id: 'message-1' };
    const { client, requests } = fakeClient(response);

    await expect(
      client.emails.send({ to: 'person@example.test', subject: 'Hello', html: '<p>Hi</p>' }),
    ).resolves.toEqual(response);

    const request = onlyRequest(requests);
    expect(String(request.input)).toBe('https://sendlib.samueltuoyo.com/api/send');
    expect(request.init?.method).toBe('POST');
    expect(parsedBody(request)).toEqual({
      to: 'person@example.test',
      subject: 'Hello',
      html: '<p>Hi</p>',
    });
  });

  it('maps every documented custom field without transforming content or attachments', async () => {
    const { client, requests } = fakeClient();
    const input = {
      from: '"Alex at Company" <hello@example.test>',
      to: ['first@example.test', 'second@example.test'],
      subject: 'Quick update',
      html: '<p>Exact HTML</p>',
      text: 'Exact text',
      replyTo: 'reply@example.test',
      cc: ['cc1@example.test', 'cc2@example.test'],
      bcc: ['audit@example.test'],
      attachments: [
        { filename: 'one.txt', content: 'T05F', type: 'text/plain' },
        { filename: 'two.bin', content: 'VFdP' },
      ],
    } as const;

    await client.emails.send(input);

    expect(parsedBody(onlyRequest(requests))).toEqual(input);
  });

  it('preserves a single attachment exactly', async () => {
    const { client, requests } = fakeClient();
    const attachment = { filename: 'receipt.pdf', content: 'JVBERi0=', type: 'application/pdf' };

    await client.emails.send({
      to: 'person@example.test',
      subject: 'Receipt',
      html: '<p>Your receipt is attached.</p>',
      attachments: [attachment],
    });

    expect(parsedBody(onlyRequest(requests))).toMatchObject({ attachments: [attachment] });
  });

  it('allow-lists request fields and does not mutate the caller input', async () => {
    const { client, requests } = fakeClient();
    const input = {
      to: 'person@example.test',
      subject: 'Hello',
      html: '<p>Hi</p>',
      runtimeOnly: 'do-not-forward',
    };
    const before = structuredClone(input);

    await client.emails.send(input);

    expect(input).toEqual(before);
    expect(parsedBody(onlyRequest(requests))).not.toHaveProperty('runtimeOnly');
  });

  it('preserves documented debug issues and unknown success fields', async () => {
    const response = {
      debug: { issues: [{ category: 'synthetic' }], futureDebug: 42 },
      futureField: { nested: true },
    };
    const { client } = fakeClient(response);

    await expect(
      client.emails.send({ to: 'person@example.test', subject: 'Hello', html: '<p>Hi</p>' }),
    ).resolves.toEqual(response);
  });

  it('validates input and call options before invoking Fetch', async () => {
    const { client, requests } = fakeClient();

    await expect(
      client.emails.send({ to: 'person@example.test', subject: 'Hello', html: '' }),
    ).rejects.toBeInstanceOf(SendlibValidationError);
    await expect(
      client.emails.send(
        { to: 'person@example.test', subject: 'Hello', html: '<p>Hi</p>' },
        { timeoutMs: -1 },
      ),
    ).rejects.toBeInstanceOf(SendlibValidationError);
    expect(requests).toHaveLength(0);
  });

  it.each([
    [
      400,
      '{"message":"Missing template variable","field":"name"}',
      SendlibApiError,
      { message: 'Missing template variable', field: 'name' },
    ],
    [
      401,
      'plain authentication failure',
      SendlibAuthenticationError,
      'plain authentication failure',
    ],
    [403, '{broken', SendlibForbiddenError, '{broken'],
    [413, '', SendlibPayloadTooLargeError, undefined],
    [429, 'null', SendlibRateLimitError, null],
    [500, '[]', SendlibApiError, []],
  ])(
    'maps a documented %i response without assuming its body shape',
    async (status, body, ErrorClass, expectedBody) => {
      const { client } = fakeClient(body, { status });

      try {
        await client.emails.send({
          to: 'person@example.test',
          template: 'dashboard-template',
          data: { name: 'Person' },
        });
        expect.unreachable('Expected the request to fail');
      } catch (error: unknown) {
        expect(error).toBeInstanceOf(ErrorClass);
        if (!(error instanceof SendlibApiError)) throw error;
        expect(error.status).toBe(status);
        expect(error.body).toEqual(expectedBody);
      }
    },
  );
});

describe('templates', () => {
  const input = {
    from: '"Support" <support@example.test>',
    to: 'person@example.test',
    data: { name: 'Person', nested: { count: 2 }, enabled: true, nullable: null },
  } as const;

  it('sends an arbitrary dashboard slug through the same email implementation', async () => {
    const { client, requests } = fakeClient();

    await client.templates.send('my-custom-template', input, {
      signal: new AbortController().signal,
      timeoutMs: 1_000,
    });

    expect(parsedBody(onlyRequest(requests))).toEqual({ ...input, template: 'my-custom-template' });
  });

  it('supports an omitted sender', async () => {
    const { client, requests } = fakeClient();

    await client.templates.welcome({ to: input.to, data: input.data });

    expect(parsedBody(onlyRequest(requests))).toEqual({
      to: input.to,
      template: 'welcome',
      data: input.data,
    });
  });

  it.each([
    ['welcome', 'welcome'],
    ['verifyEmail', 'verify-email'],
    ['passwordReset', 'password-reset'],
    ['otp', 'otp'],
    ['invoice', 'invoice'],
    ['paymentSuccessful', 'payment-successful'],
    ['paymentFailed', 'payment-failed'],
    ['subscriptionExpiring', 'subscription-expiring'],
    ['accountSuspended', 'account-suspended'],
  ] as const)('maps %s to the exact %s slug', async (method, slug) => {
    const { client, requests } = fakeClient();

    await client.templates[method](input);

    expect(parsedBody(onlyRequest(requests))).toEqual({ ...input, template: slug });
  });

  it('rejects an empty generic slug before invoking Fetch', async () => {
    const { client, requests } = fakeClient();

    await expect(client.templates.send('', input)).rejects.toBeInstanceOf(SendlibValidationError);
    expect(requests).toHaveLength(0);
  });
});
