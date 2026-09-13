import {
  SendlibAbortError,
  SendlibApiError,
  type SendlibApiErrorOptions,
  SendlibAuthenticationError,
  SendlibBatchFailedError,
  SendlibBatchWaitTimeoutError,
  SendlibConfigError,
  SendlibError,
  SendlibForbiddenError,
  SendlibNetworkError,
  SendlibPayloadTooLargeError,
  SendlibPlanRequiredError,
  SendlibRateLimitError,
  SendlibTimeoutError,
  SendlibValidationError,
} from '../../src/index.js';

export const apiErrorOptions: SendlibApiErrorOptions = {
  body: { futureShape: true },
  requestId: 'request-123',
  retryAfterMs: 1_000,
  upstreamCode: 'UNVERIFIED_CODE',
  upstreamMessage: 'Unverified upstream message',
};

export const publicErrorClasses: readonly (new (...arguments_: never[]) => SendlibError)[] = [
  SendlibError,
  SendlibConfigError,
  SendlibValidationError,
  SendlibApiError,
  SendlibAuthenticationError,
  SendlibBatchFailedError,
  SendlibBatchWaitTimeoutError,
  SendlibForbiddenError,
  SendlibPlanRequiredError,
  SendlibPayloadTooLargeError,
  SendlibRateLimitError,
  SendlibTimeoutError,
  SendlibAbortError,
  SendlibNetworkError,
];

export const batchFailedError: SendlibError = new SendlibBatchFailedError('batch-id', {
  status: 'failed',
});
export const batchWaitTimeoutError: SendlibError = new SendlibBatchWaitTimeoutError(
  'batch-id',
  60_000,
);

declare const error: SendlibError;

function acceptPlanMetadata(feature: 'batch', requiredPlan: 'pro'): readonly ['batch', 'pro'] {
  return [feature, requiredPlan];
}

export function inspectError(): number | undefined {
  if (error instanceof SendlibPlanRequiredError) {
    acceptPlanMetadata(error.feature, error.requiredPlan);
  }

  if (error instanceof SendlibApiError) return error.status;
  return undefined;
}
