import type {
  Attachment,
  CreateBatchInput,
  SendEmailInput,
  SendlibCallOptions,
  SendlibOptions,
  WaitForBatchOptions,
} from '../types.js';

const IMMEDIATE_RECIPIENT_LIMIT = 50;
const BATCH_RECIPIENT_LIMIT = 2_000;
const SUBJECT_LENGTH_LIMIT = 998;

type UnknownRecord = Record<string, unknown>;

function hasOwn(value: UnknownRecord, key: string): boolean {
  return Object.hasOwn(value, key);
}

function assertRecord(value: unknown, path: string): asserts value is UnknownRecord {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new TypeError(`${path} must be an object`);
  }
}

function assertNonBlankString(value: unknown, path: string): asserts value is string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new TypeError(`${path} must be a non-empty string`);
  }
}

function assertOptionalString(value: UnknownRecord, key: string, path: string): void {
  if (hasOwn(value, key)) assertNonBlankString(value[key], path);
}

function assertFiniteNonnegativeNumber(value: unknown, path: string): asserts value is number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new RangeError(`${path} must be a finite, nonnegative number`);
  }
}

function assertAbortSignal(value: unknown, path: string): asserts value is AbortSignal {
  assertRecord(value, path);
  if (
    typeof value.aborted !== 'boolean' ||
    typeof value.addEventListener !== 'function' ||
    typeof value.removeEventListener !== 'function'
  ) {
    throw new TypeError(`${path} must be an AbortSignal`);
  }
}

function assertRecipientField(value: unknown, path: string): void {
  if (typeof value === 'string') {
    assertNonBlankString(value, path);
    return;
  }

  if (!Array.isArray(value)) {
    throw new TypeError(`${path} must be an email string or an array of email strings`);
  }

  if (value.length === 0) throw new RangeError(`${path} must contain at least one recipient`);
  if (value.length > IMMEDIATE_RECIPIENT_LIMIT) {
    throw new RangeError(
      `${path} cannot contain more than ${String(IMMEDIATE_RECIPIENT_LIMIT)} recipients`,
    );
  }

  value.forEach((recipient, index) => {
    assertNonBlankString(recipient, `${path}[${String(index)}]`);
  });
}

function assertAttachment(value: unknown, index: number): asserts value is Attachment {
  const path = `input.attachments[${String(index)}]`;
  assertRecord(value, path);
  assertNonBlankString(value.filename, `${path}.filename`);
  assertNonBlankString(value.content, `${path}.content`);
  assertOptionalString(value, 'type', `${path}.type`);
}

function assertAttachments(value: unknown): void {
  if (!Array.isArray(value)) throw new TypeError('input.attachments must be an array');
  value.forEach(assertAttachment);
}

function rejectPresentFields(value: UnknownRecord, fields: readonly string[], mode: string): void {
  for (const field of fields) {
    if (hasOwn(value, field))
      throw new TypeError(`input.${field} is not supported in ${mode} mode`);
  }
}

/** Validate constructor configuration without reading environment variables. */
export function assertValidSendlibOptions(options: unknown): asserts options is SendlibOptions {
  assertRecord(options, 'options');
  assertNonBlankString(options.apiKey, 'options.apiKey');

  if (hasOwn(options, 'baseUrl')) {
    assertNonBlankString(options.baseUrl, 'options.baseUrl');

    let parsed: URL;
    try {
      parsed = new URL(options.baseUrl);
    } catch {
      throw new TypeError('options.baseUrl must be an absolute HTTP(S) URL');
    }

    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new TypeError('options.baseUrl must be an absolute HTTP(S) URL');
    }
  }

  if (
    hasOwn(options, 'authMode') &&
    options.authMode !== 'bearer' &&
    options.authMode !== 'x-api-key'
  ) {
    throw new TypeError("options.authMode must be 'bearer' or 'x-api-key'");
  }

  if (hasOwn(options, 'timeoutMs')) {
    assertFiniteNonnegativeNumber(options.timeoutMs, 'options.timeoutMs');
  }

  if (hasOwn(options, 'maxRetries')) {
    assertFiniteNonnegativeNumber(options.maxRetries, 'options.maxRetries');
    if (!Number.isInteger(options.maxRetries)) {
      throw new RangeError('options.maxRetries must be an integer');
    }
  }

  if (hasOwn(options, 'fetch') && typeof options.fetch !== 'function') {
    throw new TypeError('options.fetch must be a function');
  }
}

/** Validate per-request timeout and cancellation controls. */
export function assertValidSendlibCallOptions(
  options: unknown,
): asserts options is SendlibCallOptions | undefined {
  if (options === undefined) return;
  assertRecord(options, 'options');

  if (hasOwn(options, 'timeoutMs')) {
    assertFiniteNonnegativeNumber(options.timeoutMs, 'options.timeoutMs');
  }
  if (hasOwn(options, 'signal')) {
    assertAbortSignal(options.signal, 'options.signal');
  }
}

/** Validate an immediate custom or template send without mutating it. */
export function assertValidSendEmailInput(input: unknown): asserts input is SendEmailInput {
  assertRecord(input, 'input');

  if (hasOwn(input, 'template')) {
    assertNonBlankString(input.template, 'input.template');
    assertNonBlankString(input.to, 'input.to');
    assertRecord(input.data, 'input.data');
    assertOptionalString(input, 'from', 'input.from');
    rejectPresentFields(
      input,
      ['subject', 'html', 'text', 'replyTo', 'cc', 'bcc', 'attachments'],
      'template',
    );
    return;
  }

  rejectPresentFields(input, ['data'], 'custom');
  assertRecipientField(input.to, 'input.to');
  assertNonBlankString(input.subject, 'input.subject');
  if (input.subject.length > SUBJECT_LENGTH_LIMIT) {
    throw new RangeError(`input.subject cannot exceed ${String(SUBJECT_LENGTH_LIMIT)} characters`);
  }
  assertNonBlankString(input.html, 'input.html');
  assertOptionalString(input, 'text', 'input.text');
  assertOptionalString(input, 'from', 'input.from');
  assertOptionalString(input, 'replyTo', 'input.replyTo');

  if (hasOwn(input, 'cc')) assertRecipientField(input.cc, 'input.cc');
  if (hasOwn(input, 'bcc')) assertRecipientField(input.bcc, 'input.bcc');
  if (hasOwn(input, 'attachments')) assertAttachments(input.attachments);
}

/** Validate a Pro batch request without applying account-specific limits. */
export function assertValidCreateBatchInput(input: unknown): asserts input is CreateBatchInput {
  assertRecord(input, 'input');
  assertNonBlankString(input.from, 'input.from');
  assertNonBlankString(input.subject, 'input.subject');
  if (input.subject.length > SUBJECT_LENGTH_LIMIT) {
    throw new RangeError(`input.subject cannot exceed ${String(SUBJECT_LENGTH_LIMIT)} characters`);
  }

  if (!Array.isArray(input.recipients)) {
    throw new TypeError('input.recipients must be an array');
  }
  if (input.recipients.length === 0) {
    throw new RangeError('input.recipients must contain at least one recipient');
  }
  if (input.recipients.length > BATCH_RECIPIENT_LIMIT) {
    throw new RangeError(
      `input.recipients cannot contain more than ${String(BATCH_RECIPIENT_LIMIT)} recipients`,
    );
  }

  input.recipients.forEach((recipient, index) => {
    const path = `input.recipients[${String(index)}]`;
    assertRecord(recipient, path);
    assertNonBlankString(recipient.email, `${path}.email`);
    if (hasOwn(recipient, 'variables')) assertRecord(recipient.variables, `${path}.variables`);
  });

  const hasHtml = hasOwn(input, 'html');
  const hasText = hasOwn(input, 'text');
  if (!hasHtml && !hasText) throw new TypeError('input must include html, text, or both');
  if (hasHtml) assertNonBlankString(input.html, 'input.html');
  if (hasText) assertNonBlankString(input.text, 'input.text');

  assertOptionalString(input, 'replyTo', 'input.replyTo');
  if (hasOwn(input, 'attachments')) {
    throw new TypeError('input.attachments is not supported for batch sends');
  }
}

/** Validate the bounded polling controls used by the batch wait helper. */
export function assertValidWaitForBatchOptions(
  options: unknown,
): asserts options is WaitForBatchOptions | undefined {
  if (options === undefined) return;
  assertRecord(options, 'options');

  if (hasOwn(options, 'intervalMs')) {
    assertFiniteNonnegativeNumber(options.intervalMs, 'options.intervalMs');
    if (options.intervalMs === 0) {
      throw new RangeError('options.intervalMs must be greater than zero');
    }
  }
  if (hasOwn(options, 'timeoutMs')) {
    assertFiniteNonnegativeNumber(options.timeoutMs, 'options.timeoutMs');
  }
  if (hasOwn(options, 'returnOnPausedLimit') && typeof options.returnOnPausedLimit !== 'boolean') {
    throw new TypeError('options.returnOnPausedLimit must be a boolean');
  }
  if (hasOwn(options, 'signal')) {
    assertAbortSignal(options.signal, 'options.signal');
  }
}

/** Validate a caller-provided batch identifier before placing it in a URL. */
export function assertValidBatchId(batchId: unknown): asserts batchId is string {
  assertNonBlankString(batchId, 'batchId');
}
