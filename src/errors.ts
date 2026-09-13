/** Optional metadata retained from an upstream SendLib response. */
export interface SendlibApiErrorOptions extends ErrorOptions {
  readonly body?: unknown;
  readonly requestId?: string;
  readonly retryAfterMs?: number;
  readonly upstreamCode?: string;
  readonly upstreamMessage?: string;
}

/** Base class for every error intentionally produced by the SDK. */
export class SendlibError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'SendlibError';
  }
}

/** Invalid SDK configuration detected before an API request. */
export class SendlibConfigError extends SendlibError {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'SendlibConfigError';
  }
}

/** Invalid request input detected locally before an API request. */
export class SendlibValidationError extends SendlibError {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'SendlibValidationError';
  }
}

/** A non-success HTTP response returned by SendLib. */
export class SendlibApiError extends SendlibError {
  declare readonly body: unknown;
  readonly requestId?: string;
  readonly retryAfterMs?: number;
  readonly status: number;
  declare readonly upstreamCode?: string;
  declare readonly upstreamMessage?: string;

  constructor(message: string, status: number, options: SendlibApiErrorOptions = {}) {
    super(message, options);
    this.name = 'SendlibApiError';
    this.status = status;

    Object.defineProperty(this, 'body', {
      configurable: false,
      enumerable: false,
      value: options.body,
      writable: false,
    });

    if (options.requestId !== undefined) this.requestId = options.requestId;
    if (options.retryAfterMs !== undefined) this.retryAfterMs = options.retryAfterMs;
    if (options.upstreamCode !== undefined) {
      Object.defineProperty(this, 'upstreamCode', {
        configurable: false,
        enumerable: false,
        value: options.upstreamCode,
        writable: false,
      });
    }
    if (options.upstreamMessage !== undefined) {
      Object.defineProperty(this, 'upstreamMessage', {
        configurable: false,
        enumerable: false,
        value: options.upstreamMessage,
        writable: false,
      });
    }
  }
}

/** SendLib rejected the API key. */
export class SendlibAuthenticationError extends SendlibApiError {
  constructor(options: SendlibApiErrorOptions = {}) {
    super('SendLib authentication failed.', 401, options);
    this.name = 'SendlibAuthenticationError';
  }
}

/** SendLib authenticated the request but denied access. */
export class SendlibForbiddenError extends SendlibApiError {
  constructor(options: SendlibApiErrorOptions = {}, message = 'SendLib denied the request.') {
    super(message, 403, options);
    this.name = 'SendlibForbiddenError';
  }
}

/** A documented Pro-plan requirement for a SendLib batch endpoint. */
export class SendlibPlanRequiredError extends SendlibForbiddenError {
  readonly feature = 'batch' as const;
  readonly requiredPlan = 'pro' as const;

  constructor(options: SendlibApiErrorOptions = {}) {
    super(options, 'Batch sending requires a SendLib Pro plan.');
    this.name = 'SendlibPlanRequiredError';
  }
}

/** The request exceeds SendLib's payload limits. */
export class SendlibPayloadTooLargeError extends SendlibApiError {
  constructor(options: SendlibApiErrorOptions = {}) {
    super('The SendLib request payload is too large.', 413, options);
    this.name = 'SendlibPayloadTooLargeError';
  }
}

/** SendLib refused the request because a rate limit was reached. */
export class SendlibRateLimitError extends SendlibApiError {
  constructor(options: SendlibApiErrorOptions = {}) {
    super('SendLib rate limit exceeded.', 429, options);
    this.name = 'SendlibRateLimitError';
  }
}

/** A request exceeded its configured per-attempt timeout. */
export class SendlibTimeoutError extends SendlibError {
  constructor(options?: ErrorOptions) {
    super('The SendLib request timed out.', options);
    this.name = 'SendlibTimeoutError';
  }
}

/** A request was explicitly cancelled through the caller's AbortSignal. */
export class SendlibAbortError extends SendlibError {
  constructor(options?: ErrorOptions) {
    super('The SendLib request was cancelled.', options);
    this.name = 'SendlibAbortError';
  }
}

/** Fetch failed before a SendLib HTTP response was available. */
export class SendlibNetworkError extends SendlibError {
  constructor(options?: ErrorOptions) {
    super('Unable to reach SendLib.', options);
    this.name = 'SendlibNetworkError';
  }
}

/** A batch job reached SendLib's documented terminal `failed` state. */
export class SendlibBatchFailedError extends SendlibError {
  readonly batchId: string;
  declare readonly response: unknown;

  constructor(batchId: string, response: unknown, options?: ErrorOptions) {
    super('The SendLib batch failed.', options);
    this.name = 'SendlibBatchFailedError';
    this.batchId = batchId;
    Object.defineProperty(this, 'response', {
      configurable: false,
      enumerable: false,
      value: response,
      writable: false,
    });
  }
}

/** The SDK's bounded batch-status polling exceeded its overall deadline. */
export class SendlibBatchWaitTimeoutError extends SendlibError {
  readonly batchId: string;
  readonly timeoutMs: number;

  constructor(batchId: string, timeoutMs: number, options?: ErrorOptions) {
    super('Timed out waiting for the SendLib batch.', options);
    this.name = 'SendlibBatchWaitTimeoutError';
    this.batchId = batchId;
    this.timeoutMs = timeoutMs;
  }
}

type ApiFeature = 'batch' | 'email' | undefined;

interface ApiFailure {
  readonly body: unknown;
  readonly headers: Headers;
  readonly status: number;
}

function readStringField(body: unknown, field: string): string | undefined {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) return undefined;
  const value = (body as Record<string, unknown>)[field];
  return typeof value === 'string' ? value : undefined;
}

/** Parse the documented Retry-After delta-seconds or HTTP-date formats. */
export function parseRetryAfter(value: string | null, now = Date.now()): number | undefined {
  if (value === null) return undefined;
  const normalized = value.trim();

  if (/^\d+$/u.test(normalized)) {
    const milliseconds = Number(normalized) * 1_000;
    return Number.isFinite(milliseconds) ? milliseconds : undefined;
  }

  const isHttpDate =
    /^(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun), \d{2} (?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d{4} \d{2}:\d{2}:\d{2} GMT$/u.test(
      normalized,
    );
  if (!isHttpDate) return undefined;

  const timestamp = Date.parse(normalized);
  return Number.isFinite(timestamp) ? Math.max(0, timestamp - now) : undefined;
}

function apiErrorOptions(response: ApiFailure): SendlibApiErrorOptions {
  const requestId = response.headers.get('x-request-id') ?? undefined;
  const retryAfterMs = parseRetryAfter(response.headers.get('retry-after'));
  const upstreamCode = readStringField(response.body, 'code');
  const upstreamMessage = readStringField(response.body, 'message');

  return {
    body: response.body,
    ...(requestId === undefined ? {} : { requestId }),
    ...(retryAfterMs === undefined ? {} : { retryAfterMs }),
    ...(upstreamCode === undefined ? {} : { upstreamCode }),
    ...(upstreamMessage === undefined ? {} : { upstreamMessage }),
  };
}

/** Internal conversion from a non-success response to the public hierarchy. */
export function createSendlibApiError(response: ApiFailure, feature?: ApiFeature): SendlibApiError {
  const options = apiErrorOptions(response);

  switch (response.status) {
    case 401:
      return new SendlibAuthenticationError(options);
    case 403:
      return feature === 'batch'
        ? new SendlibPlanRequiredError(options)
        : new SendlibForbiddenError(options);
    case 413:
      return new SendlibPayloadTooLargeError(options);
    case 429:
      return new SendlibRateLimitError(options);
    default:
      return new SendlibApiError(
        `SendLib API request failed with status ${String(response.status)}.`,
        response.status,
        options,
      );
  }
}
