import {
  SendlibAbortError,
  SendlibBatchFailedError,
  SendlibBatchWaitTimeoutError,
  SendlibValidationError,
} from './errors.js';
import { BATCH_WAIT_DEFAULTS, SENDLIB_DEFAULTS } from './internal/config.js';
import { sendlibRequest } from './internal/transport.js';
import {
  assertValidBatchId,
  assertValidCreateBatchInput,
  assertValidSendlibCallOptions,
  assertValidWaitForBatchOptions,
} from './internal/validation.js';
import type {
  BatchRecipient,
  BatchStatusResponse,
  CreateBatchInput,
  CreateBatchResponse,
  SendlibCallOptions,
  SendlibOptions,
  WaitForBatchOptions,
} from './types.js';

/** Pro-only batch operations exposed by {@link Sendlib}. */
export interface SendlibBatches {
  /** Queue a Pro batch through `POST /api/batch`. This POST is never retried automatically. */
  create(input: CreateBatchInput, options?: SendlibCallOptions): Promise<CreateBatchResponse>;
  /** Retrieve one batch through the safely retryable `GET /api/batch/:batchId` endpoint. */
  retrieve(batchId: string, options?: SendlibCallOptions): Promise<BatchStatusResponse>;
  /** Poll a Pro batch until it is done, failed, paused, cancelled, or the overall deadline expires. */
  wait(batchId: string, options?: WaitForBatchOptions): Promise<BatchStatusResponse>;
}

function validationError(error: unknown): SendlibValidationError {
  return new SendlibValidationError((error as Error).message, { cause: error });
}

function validateCreate(input: unknown, options: unknown): asserts input is CreateBatchInput {
  try {
    assertValidCreateBatchInput(input);
    assertValidSendlibCallOptions(options);
  } catch (error) {
    throw validationError(error);
  }
}

function validateRetrieve(batchId: unknown, options: unknown): asserts batchId is string {
  try {
    assertValidBatchId(batchId);
    assertValidSendlibCallOptions(options);
  } catch (error) {
    throw validationError(error);
  }
}

function validateWait(batchId: unknown, options: unknown): asserts batchId is string {
  try {
    assertValidBatchId(batchId);
    assertValidWaitForBatchOptions(options);
  } catch (error) {
    throw validationError(error);
  }
}

function recipientPayload(recipient: BatchRecipient): BatchRecipient {
  return {
    email: recipient.email,
    ...(recipient.variables === undefined ? {} : { variables: recipient.variables }),
  };
}

function createPayload(input: CreateBatchInput): CreateBatchInput {
  return {
    from: input.from,
    subject: input.subject,
    recipients: input.recipients.map(recipientPayload),
    ...(input.html === undefined ? {} : { html: input.html }),
    ...(input.text === undefined ? {} : { text: input.text }),
    ...(input.replyTo === undefined ? {} : { replyTo: input.replyTo }),
  } as CreateBatchInput;
}

interface WaitAbortContext {
  readonly signal: AbortSignal;
  readonly kind: () => 'caller' | 'timeout' | undefined;
  readonly cleanup: () => void;
}

function createWaitAbortContext(timeoutMs: number, callerSignal?: AbortSignal): WaitAbortContext {
  const controller = new AbortController();
  let abortKind: 'caller' | 'timeout' | undefined;

  const abort = (kind: 'caller' | 'timeout', reason?: unknown): void => {
    if (controller.signal.aborted) return;
    abortKind = kind;
    controller.abort(reason);
  };
  const abortFromCaller = (): void => {
    abort('caller', callerSignal?.reason);
  };

  if (callerSignal?.aborted === true) abortFromCaller();
  else callerSignal?.addEventListener('abort', abortFromCaller, { once: true });

  const timeout = setTimeout(() => {
    abort('timeout');
  }, timeoutMs);

  return {
    signal: controller.signal,
    kind: () => abortKind,
    cleanup: () => {
      clearTimeout(timeout);
      callerSignal?.removeEventListener('abort', abortFromCaller);
    },
  };
}

function waitDelay(milliseconds: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const onAbort = (): void => {
      clearTimeout(timeout);
      signal.removeEventListener('abort', onAbort);
      reject(new SendlibAbortError());
    };
    const timeout = setTimeout(() => {
      signal.removeEventListener('abort', onAbort);
      resolve();
    }, milliseconds);

    signal.addEventListener('abort', onAbort, { once: true });
  });
}

/** Internal batch resource factory used by the public client. */
export function createBatches(clientOptions: SendlibOptions): SendlibBatches {
  return Object.freeze(new Batches(clientOptions));
}

class Batches implements SendlibBatches {
  constructor(private readonly clientOptions: SendlibOptions) {}

  async create(
    input: CreateBatchInput,
    options?: SendlibCallOptions,
  ): Promise<CreateBatchResponse> {
    validateCreate(input, options);
    const response = await sendlibRequest<CreateBatchResponse>(this.clientOptions, {
      method: 'POST',
      path: '/api/batch',
      feature: 'batch',
      body: createPayload(input),
      ...(options?.signal === undefined ? {} : { signal: options.signal }),
      ...(options?.timeoutMs === undefined ? {} : { timeoutMs: options.timeoutMs }),
    });
    return response.body;
  }

  async retrieve(batchId: string, options?: SendlibCallOptions): Promise<BatchStatusResponse> {
    validateRetrieve(batchId, options);
    const response = await sendlibRequest<BatchStatusResponse>(this.clientOptions, {
      method: 'GET',
      path: `/api/batch/${encodeURIComponent(batchId)}`,
      feature: 'batch',
      ...(options?.signal === undefined ? {} : { signal: options.signal }),
      ...(options?.timeoutMs === undefined ? {} : { timeoutMs: options.timeoutMs }),
    });
    return response.body;
  }

  async wait(batchId: string, options?: WaitForBatchOptions): Promise<BatchStatusResponse> {
    validateWait(batchId, options);
    const intervalMs = options?.intervalMs ?? BATCH_WAIT_DEFAULTS.intervalMs;
    const timeoutMs = options?.timeoutMs ?? BATCH_WAIT_DEFAULTS.timeoutMs;
    const returnOnPausedLimit =
      options?.returnOnPausedLimit ?? BATCH_WAIT_DEFAULTS.returnOnPausedLimit;

    if (timeoutMs === 0) {
      if (options?.signal?.aborted === true) throw new SendlibAbortError();
      throw new SendlibBatchWaitTimeoutError(batchId, timeoutMs);
    }

    const startedAt = Date.now();
    const abortContext = createWaitAbortContext(timeoutMs, options?.signal);

    try {
      for (;;) {
        const remainingMs = timeoutMs - (Date.now() - startedAt);
        if (remainingMs <= 0) throw new SendlibBatchWaitTimeoutError(batchId, timeoutMs);

        const attemptTimeoutMs = Math.min(
          this.clientOptions.timeoutMs ?? SENDLIB_DEFAULTS.timeoutMs,
          remainingMs,
        );
        const response = await this.retrieve(batchId, {
          signal: abortContext.signal,
          timeoutMs: attemptTimeoutMs,
        });

        if (response.status === 'done') return response;
        if (response.status === 'failed') {
          throw new SendlibBatchFailedError(batchId, response);
        }
        if (response.status === 'paused_limit_reached' && returnOnPausedLimit) return response;

        const delayBudgetMs = timeoutMs - (Date.now() - startedAt);
        if (delayBudgetMs <= 0) throw new SendlibBatchWaitTimeoutError(batchId, timeoutMs);
        await waitDelay(Math.min(intervalMs, delayBudgetMs), abortContext.signal);
      }
    } catch (error) {
      if (error instanceof SendlibAbortError && abortContext.kind() === 'timeout') {
        throw new SendlibBatchWaitTimeoutError(batchId, timeoutMs, { cause: error });
      }
      throw error;
    } finally {
      abortContext.cleanup();
    }
  }
}
