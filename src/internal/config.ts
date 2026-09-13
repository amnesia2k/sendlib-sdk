import type { SendlibAuthMode } from '../types.js';

export interface SendlibDefaults {
  readonly authMode: SendlibAuthMode;
  readonly baseUrl: string;
  readonly maxRetries: number;
  readonly timeoutMs: number;
}

export interface BatchWaitDefaults {
  readonly intervalMs: number;
  readonly returnOnPausedLimit: boolean;
  readonly timeoutMs: number;
}

/** Internal source of truth for all client defaults. */
export const SENDLIB_DEFAULTS: Readonly<SendlibDefaults> = Object.freeze({
  authMode: 'bearer',
  baseUrl: 'https://sendlib.samueltuoyo.com',
  maxRetries: 2,
  timeoutMs: 30_000,
});

/** Internal source of truth for bounded batch polling defaults. */
export const BATCH_WAIT_DEFAULTS: Readonly<BatchWaitDefaults> = Object.freeze({
  intervalMs: 1_000,
  returnOnPausedLimit: true,
  timeoutMs: 60_000,
});
