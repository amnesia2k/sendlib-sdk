import { describe, expect, it } from 'vitest';

import {
  createSendlibApiError,
  parseRetryAfter,
  SendlibAbortError,
  SendlibApiError,
  SendlibAuthenticationError,
  SendlibConfigError,
  SendlibError,
  SendlibForbiddenError,
  SendlibNetworkError,
  SendlibPayloadTooLargeError,
  SendlibPlanRequiredError,
  SendlibRateLimitError,
  SendlibTimeoutError,
  SendlibValidationError,
} from '../../src/errors.js';

function failure(
  status: number,
  body: unknown,
  headers: ConstructorParameters<typeof Headers>[0] = {},
): {
  body: unknown;
  headers: Headers;
  status: number;
} {
  return { body, headers: new Headers(headers), status };
}

describe('local SendLib errors', () => {
  it('provides stable names and standard causes', () => {
    const cause = new Error('synthetic cause');
    const errors = [
      new SendlibError('Safe message', { cause }),
      new SendlibConfigError('Invalid configuration', { cause }),
      new SendlibValidationError('Invalid input', { cause }),
      new SendlibTimeoutError({ cause }),
      new SendlibAbortError({ cause }),
      new SendlibNetworkError({ cause }),
    ];

    expect(errors.map(({ name }) => name)).toEqual([
      'SendlibError',
      'SendlibConfigError',
      'SendlibValidationError',
      'SendlibTimeoutError',
      'SendlibAbortError',
      'SendlibNetworkError',
    ]);
    errors.forEach((error) => {
      expect(error).toBeInstanceOf(SendlibError);
      expect(error.cause).toBe(cause);
    });
  });
});

describe('SendlibApiError', () => {
  it('retains safe metadata and keeps unknown upstream data non-enumerable', () => {
    const body = { code: 'UPSTREAM_CODE', message: 'Upstream message', details: { any: true } };
    const cause = new Error('synthetic cause');
    const error = new SendlibApiError('Safe SDK message', 422, {
      body,
      cause,
      requestId: 'request-123',
      retryAfterMs: 2_000,
      upstreamCode: 'UPSTREAM_CODE',
      upstreamMessage: 'Upstream message',
    });

    expect(error).toBeInstanceOf(SendlibError);
    expect(error).toMatchObject({
      body,
      cause,
      message: 'Safe SDK message',
      name: 'SendlibApiError',
      requestId: 'request-123',
      retryAfterMs: 2_000,
      status: 422,
      upstreamCode: 'UPSTREAM_CODE',
      upstreamMessage: 'Upstream message',
    });
    expect(JSON.parse(JSON.stringify(error))).toEqual({
      name: 'SendlibApiError',
      requestId: 'request-123',
      retryAfterMs: 2_000,
      status: 422,
    });
  });

  it('does not invent optional metadata', () => {
    const error = new SendlibApiError('Safe SDK message', 500);

    expect(error.body).toBeUndefined();
    expect(error.requestId).toBeUndefined();
    expect(error.retryAfterMs).toBeUndefined();
    expect(error.upstreamCode).toBeUndefined();
    expect(error.upstreamMessage).toBeUndefined();
  });
});

describe('createSendlibApiError', () => {
  it.each([
    [401, SendlibAuthenticationError, 'SendLib authentication failed.'],
    [403, SendlibForbiddenError, 'SendLib denied the request.'],
    [413, SendlibPayloadTooLargeError, 'The SendLib request payload is too large.'],
    [429, SendlibRateLimitError, 'SendLib rate limit exceeded.'],
    [500, SendlibApiError, 'SendLib API request failed with status 500.'],
  ])('maps status %i to %s', (status, ErrorClass, message) => {
    const error = createSendlibApiError(failure(status, ['unknown', 'shape']));

    expect(error).toBeInstanceOf(ErrorClass);
    expect(error).toMatchObject({ body: ['unknown', 'shape'], message, status });
    expect(error.upstreamCode).toBeUndefined();
    expect(error.upstreamMessage).toBeUndefined();
  });

  it('maps a batch 403 to the stable Pro-plan error', () => {
    const error = createSendlibApiError(
      failure(
        403,
        { code: 'PLAN_REQUIRED', message: 'An unverified upstream message' },
        { 'x-request-id': 'request-456' },
      ),
      'batch',
    );

    expect(error).toBeInstanceOf(SendlibPlanRequiredError);
    expect(error).toMatchObject({
      body: { code: 'PLAN_REQUIRED', message: 'An unverified upstream message' },
      feature: 'batch',
      message: 'Batch sending requires a SendLib Pro plan.',
      name: 'SendlibPlanRequiredError',
      requestId: 'request-456',
      requiredPlan: 'pro',
      status: 403,
      upstreamCode: 'PLAN_REQUIRED',
      upstreamMessage: 'An unverified upstream message',
    });
    expect(error).toBeInstanceOf(SendlibForbiddenError);
    expect(error).toBeInstanceOf(SendlibApiError);
  });

  it.each([null, 'text response', { code: 123, message: false }])(
    'preserves an undocumented body without assuming fields: %j',
    (body) => {
      const error = createSendlibApiError(failure(400, body), 'email');

      expect(error.body).toEqual(body);
      expect(error.upstreamCode).toBeUndefined();
      expect(error.upstreamMessage).toBeUndefined();
    },
  );

  it('captures a documented Retry-After header as milliseconds', () => {
    const error = createSendlibApiError(failure(429, {}, { 'retry-after': '7' }));

    expect(error.retryAfterMs).toBe(7_000);
  });
});

describe('parseRetryAfter', () => {
  const now = Date.parse('2026-09-12T20:00:00.000Z');

  it.each([
    [null, undefined],
    [' 12 ', 12_000],
    ['Sat, 12 Sep 2026 20:00:05 GMT', 5_000],
    ['Sat, 12 Sep 2026 19:59:00 GMT', 0],
    ['Sat, 99 Sep 2026 20:00:05 GMT', undefined],
    ['not-a-date', undefined],
    ['1.5', undefined],
    ['9'.repeat(400), undefined],
  ])('parses %j as %j', (value, expected) => {
    expect(parseRetryAfter(value, now)).toBe(expected);
  });
});
