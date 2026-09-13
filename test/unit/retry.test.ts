import { describe, expect, it, vi } from 'vitest';

import {
  SendlibAbortError,
  SendlibApiError,
  SendlibNetworkError,
  SendlibRateLimitError,
  SendlibValidationError,
} from '../../src/errors.js';
import { executeWithRetry } from '../../src/internal/retry.js';

function createSleepMock() {
  return vi
    .fn<(milliseconds: number, signal?: AbortSignal) => Promise<void>>()
    .mockResolvedValue(undefined);
}

describe('executeWithRetry', () => {
  it('returns the first successful attempt without sleeping', async () => {
    const operation = vi.fn((attempt: number) => Promise.resolve(`attempt-${String(attempt)}`));
    const sleep = createSleepMock();

    await expect(
      executeWithRetry(operation, { maxRetries: 2, method: 'GET' }, { random: () => 0.5, sleep }),
    ).resolves.toBe('attempt-0');
    expect(operation).toHaveBeenCalledOnce();
    expect(sleep).not.toHaveBeenCalled();
  });

  it('retries GET network failures with exponential full-jitter delays', async () => {
    const operation = vi
      .fn<(attempt: number) => Promise<string>>()
      .mockRejectedValueOnce(new SendlibNetworkError())
      .mockRejectedValueOnce(new SendlibNetworkError())
      .mockResolvedValue('done');
    const sleep = createSleepMock();

    await expect(
      executeWithRetry(operation, { maxRetries: 2, method: 'GET' }, { random: () => 0.5, sleep }),
    ).resolves.toBe('done');
    expect(operation.mock.calls.map(([attempt]) => attempt)).toEqual([0, 1, 2]);
    expect(sleep.mock.calls.map(([milliseconds]) => milliseconds)).toEqual([125, 250]);
  });

  it('honors Retry-After for rate limits', async () => {
    const operation = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new SendlibRateLimitError({ retryAfterMs: 4_000 }))
      .mockResolvedValue('done');
    const sleep = createSleepMock();

    await executeWithRetry(
      operation,
      { maxRetries: 1, method: 'GET' },
      { random: () => 0.9, sleep },
    );

    expect(sleep).toHaveBeenCalledWith(4_000, undefined);
  });

  it('uses jitter when a rate limit has no Retry-After value', async () => {
    const operation = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new SendlibRateLimitError())
      .mockResolvedValue('done');
    const sleep = createSleepMock();

    await executeWithRetry(
      operation,
      { maxRetries: 1, method: 'GET' },
      { random: () => 0.25, sleep },
    );

    expect(sleep).toHaveBeenCalledWith(62, undefined);
  });

  it.each([500, 502, 503, 504])('retries selected HTTP %i responses', async (status) => {
    const operation = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new SendlibApiError('Synthetic server error', status))
      .mockResolvedValue('done');

    await expect(
      executeWithRetry(
        operation,
        { maxRetries: 1, method: 'GET' },
        { random: () => 0, sleep: () => Promise.resolve() },
      ),
    ).resolves.toBe('done');
  });

  it.each([
    ['POST network failure', 'POST', new SendlibNetworkError()],
    ['non-selected HTTP status', 'GET', new SendlibApiError('Synthetic failure', 501)],
    ['local validation failure', 'GET', new SendlibValidationError('Invalid input')],
  ] as const)('does not retry a %s', async (_, method, failure) => {
    const operation = vi.fn(() => Promise.reject(failure));
    const sleep = createSleepMock();

    await expect(
      executeWithRetry(operation, { maxRetries: 3, method }, { random: () => 0, sleep }),
    ).rejects.toBe(failure);
    expect(operation).toHaveBeenCalledOnce();
    expect(sleep).not.toHaveBeenCalled();
  });

  it('stops after the configured retry limit', async () => {
    const failure = new SendlibNetworkError();
    const operation = vi.fn(() => Promise.reject(failure));

    await expect(
      executeWithRetry(
        operation,
        { maxRetries: 1, method: 'GET' },
        { random: () => 0, sleep: () => Promise.resolve() },
      ),
    ).rejects.toBe(failure);
    expect(operation).toHaveBeenCalledTimes(2);
  });

  it('caps exponential backoff and forwards the caller signal', async () => {
    const failure = new SendlibNetworkError();
    const operation = vi.fn(() => Promise.reject(failure));
    const sleep = createSleepMock();
    const signal = new AbortController().signal;

    await expect(
      executeWithRetry(
        operation,
        { maxRetries: 7, method: 'GET', signal },
        { random: () => 1, sleep },
      ),
    ).rejects.toBe(failure);
    expect(sleep.mock.calls.at(-1)).toEqual([10_000, signal]);
  });

  it('uses the default timer and random source when dependencies are omitted', async () => {
    vi.useFakeTimers();
    const random = vi.spyOn(Math, 'random').mockReturnValue(0);

    try {
      const operation = vi
        .fn<() => Promise<string>>()
        .mockRejectedValueOnce(new SendlibNetworkError())
        .mockResolvedValue('done');
      const result = executeWithRetry(operation, { maxRetries: 1, method: 'GET' });

      await vi.runAllTimersAsync();

      await expect(result).resolves.toBe('done');
      expect(random).toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it('rejects default sleep immediately for an already-aborted signal', async () => {
    const caller = new AbortController();
    caller.abort();

    await expect(
      executeWithRetry(
        () => Promise.reject(new SendlibNetworkError()),
        { maxRetries: 1, method: 'GET', signal: caller.signal },
        { random: () => 0 },
      ),
    ).rejects.toBeInstanceOf(SendlibAbortError);
  });

  it('cancels default sleep and removes its abort listener', async () => {
    vi.useFakeTimers();

    try {
      const caller = new AbortController();
      const addEventListener = vi.spyOn(caller.signal, 'addEventListener');
      const removeEventListener = vi.spyOn(caller.signal, 'removeEventListener');
      const result = executeWithRetry(
        () => Promise.reject(new SendlibNetworkError()),
        { maxRetries: 1, method: 'GET', signal: caller.signal },
        { random: () => 0.5 },
      );
      const rejection = expect(result).rejects.toBeInstanceOf(SendlibAbortError);

      await vi.advanceTimersByTimeAsync(0);
      expect(addEventListener).toHaveBeenCalledWith('abort', expect.any(Function), { once: true });
      caller.abort();

      await rejection;
      expect(removeEventListener).toHaveBeenCalledWith('abort', expect.any(Function));
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });
});
