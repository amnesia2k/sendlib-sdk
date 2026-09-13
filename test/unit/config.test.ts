import { describe, expect, it } from 'vitest';

import { BATCH_WAIT_DEFAULTS, SENDLIB_DEFAULTS } from '../../src/internal/config.js';

describe('SENDLIB_DEFAULTS', () => {
  it('contains the documented client defaults', () => {
    expect(SENDLIB_DEFAULTS).toEqual({
      authMode: 'bearer',
      baseUrl: 'https://sendlib.samueltuoyo.com',
      maxRetries: 2,
      timeoutMs: 30_000,
    });
  });

  it('cannot be mutated at runtime', () => {
    expect(Object.isFrozen(SENDLIB_DEFAULTS)).toBe(true);
  });
});

describe('BATCH_WAIT_DEFAULTS', () => {
  it('keeps polling bounded and returns on a Gmail limit pause', () => {
    expect(BATCH_WAIT_DEFAULTS).toEqual({
      intervalMs: 1_000,
      returnOnPausedLimit: true,
      timeoutMs: 60_000,
    });
  });

  it('cannot be mutated at runtime', () => {
    expect(Object.isFrozen(BATCH_WAIT_DEFAULTS)).toBe(true);
  });
});
