import { describe, expect, it } from 'vitest';

import {
  assertValidBatchId,
  assertValidCreateBatchInput,
  assertValidSendEmailInput,
  assertValidSendlibCallOptions,
  assertValidSendlibOptions,
  assertValidWaitForBatchOptions,
} from '../../src/internal/validation.js';

const address = 'recipient@example.test';
const sender = 'sender@example.test';

describe('assertValidSendlibOptions', () => {
  it('accepts minimal and complete configuration', () => {
    expect(() => {
      assertValidSendlibOptions({ apiKey: 'test-only-api-key' });
    }).not.toThrow();
    expect(() => {
      assertValidSendlibOptions({
        apiKey: 'test-only-api-key',
        baseUrl: 'http://localhost:3000/proxy',
        authMode: 'x-api-key',
        timeoutMs: 0,
        maxRetries: 2,
        fetch: () => Promise.resolve(new Response()),
      });
    }).not.toThrow();
  });

  it.each([
    [null, 'options'],
    [[], 'options'],
    [{}, 'apiKey'],
    [{ apiKey: '' }, 'apiKey'],
    [{ apiKey: '   ' }, 'apiKey'],
    [{ apiKey: 'key', baseUrl: undefined }, 'baseUrl'],
    [{ apiKey: 'key', baseUrl: '/relative' }, 'baseUrl'],
    [{ apiKey: 'key', baseUrl: 'not a URL' }, 'baseUrl'],
    [{ apiKey: 'key', baseUrl: 'ftp://example.test' }, 'baseUrl'],
    [{ apiKey: 'key', authMode: 'basic' }, 'authMode'],
    [{ apiKey: 'key', timeoutMs: -1 }, 'timeoutMs'],
    [{ apiKey: 'key', timeoutMs: Number.POSITIVE_INFINITY }, 'timeoutMs'],
    [{ apiKey: 'key', maxRetries: -1 }, 'maxRetries'],
    [{ apiKey: 'key', maxRetries: 1.5 }, 'integer'],
    [{ apiKey: 'key', fetch: undefined }, 'fetch'],
    [{ apiKey: 'key', fetch: 'not-a-function' }, 'fetch'],
  ])('rejects invalid configuration %#', (options, message) => {
    expect(() => {
      assertValidSendlibOptions(options);
    }).toThrow(message);
  });
});

describe('assertValidSendlibCallOptions', () => {
  it('accepts omission and complete per-request controls', () => {
    expect(() => {
      assertValidSendlibCallOptions(undefined);
    }).not.toThrow();
    expect(() => {
      assertValidSendlibCallOptions({});
    }).not.toThrow();
    expect(() => {
      assertValidSendlibCallOptions({
        signal: new AbortController().signal,
        timeoutMs: 0,
      });
    }).not.toThrow();
  });

  it.each([
    [null, 'options'],
    [{ timeoutMs: undefined }, 'timeoutMs'],
    [{ timeoutMs: -1 }, 'timeoutMs'],
    [{ timeoutMs: Number.POSITIVE_INFINITY }, 'timeoutMs'],
    [{ signal: undefined }, 'signal'],
    [{ signal: null }, 'signal'],
    [{ signal: {} }, 'AbortSignal'],
    [{ signal: { aborted: false, addEventListener: 'no' } }, 'AbortSignal'],
    [{ signal: { aborted: false, addEventListener: () => undefined } }, 'AbortSignal'],
  ])('rejects invalid per-request controls %#', (options, message) => {
    expect(() => {
      assertValidSendlibCallOptions(options);
    }).toThrow(message);
  });
});

describe('assertValidSendEmailInput', () => {
  it('accepts custom and template modes without mutation', () => {
    const custom = Object.freeze({
      from: sender,
      to: Object.freeze([address, 'second@example.test']),
      subject: 'Account notification',
      html: '<p>Body</p>',
      text: 'Body',
      replyTo: 'support@example.test',
      cc: address,
      bcc: Object.freeze(['audit@example.test']),
      attachments: Object.freeze([
        Object.freeze({ filename: 'notice.txt', content: 'VGVzdA==', type: 'text/plain' }),
      ]),
    });
    const template = Object.freeze({
      from: sender,
      to: address,
      template: 'account-notification',
      data: Object.freeze({ name: 'Test Recipient' }),
    });
    const before = JSON.stringify({ custom, template });

    expect(() => {
      assertValidSendEmailInput({ to: address, subject: 'Minimal', html: '<p>Body</p>' });
    }).not.toThrow();
    expect(() => {
      assertValidSendEmailInput(custom);
    }).not.toThrow();
    expect(() => {
      assertValidSendEmailInput(template);
    }).not.toThrow();
    expect(JSON.stringify({ custom, template })).toBe(before);
  });

  it('accepts the documented immediate-send field and subject boundaries', () => {
    const fiftyRecipients = Array.from(
      { length: 50 },
      (_, index) => `recipient-${String(index)}@example.test`,
    );

    expect(() => {
      assertValidSendEmailInput({
        to: fiftyRecipients,
        cc: fiftyRecipients,
        bcc: fiftyRecipients,
        subject: 'x'.repeat(998),
        html: '<p>Body</p>',
      });
    }).not.toThrow();
  });

  it.each([
    [null, 'input'],
    [{ to: address, subject: 'Subject', html: '<p>Body</p>', data: {} }, 'data'],
    [{ to: [], subject: 'Subject', html: '<p>Body</p>' }, 'at least one'],
    [{ to: 42, subject: 'Subject', html: '<p>Body</p>' }, 'email string'],
    [{ to: [''], subject: 'Subject', html: '<p>Body</p>' }, 'input.to[0]'],
    [
      { to: Array.from({ length: 51 }, () => address), subject: 'Subject', html: '<p>Body</p>' },
      'more than 50',
    ],
    [{ to: address, subject: '', html: '<p>Body</p>' }, 'subject'],
    [{ to: address, subject: 'x'.repeat(999), html: '<p>Body</p>' }, '998'],
    [{ to: address, subject: 'Subject', html: '' }, 'html'],
    [{ to: address, subject: 'Subject', html: '<p>Body</p>', text: undefined }, 'text'],
    [{ to: address, subject: 'Subject', html: '<p>Body</p>', from: undefined }, 'from'],
    [{ to: address, subject: 'Subject', html: '<p>Body</p>', replyTo: '' }, 'replyTo'],
    [{ to: address, subject: 'Subject', html: '<p>Body</p>', cc: [] }, 'input.cc'],
    [{ to: address, subject: 'Subject', html: '<p>Body</p>', bcc: 1 }, 'input.bcc'],
    [{ to: address, subject: 'Subject', html: '<p>Body</p>', attachments: {} }, 'array'],
    [
      { to: address, subject: 'Subject', html: '<p>Body</p>', attachments: [null] },
      'attachments[0]',
    ],
    [{ to: address, subject: 'Subject', html: '<p>Body</p>', attachments: [{}] }, 'filename'],
    [
      {
        to: address,
        subject: 'Subject',
        html: '<p>Body</p>',
        attachments: [{ filename: 'x', content: '' }],
      },
      'content',
    ],
    [
      {
        to: address,
        subject: 'Subject',
        html: '<p>Body</p>',
        attachments: [{ filename: 'x', content: 'eA==', type: undefined }],
      },
      'type',
    ],
    [{ template: '', to: address, data: {} }, 'template'],
    [{ template: 'notice', to: [address], data: {} }, 'input.to'],
    [{ template: 'notice', to: address, data: [] }, 'input.data'],
    [{ template: 'notice', to: address, data: {}, from: undefined }, 'input.from'],
    [{ template: 'notice', to: address, data: {}, subject: undefined }, 'subject'],
  ])('rejects invalid email input %#', (input, message) => {
    expect(() => {
      assertValidSendEmailInput(input);
    }).toThrow(message);
  });
});

describe('assertValidCreateBatchInput', () => {
  const base = { from: sender, subject: 'Batch notice', recipients: [{ email: address }] };

  it('accepts HTML-only, text-only, and combined batches without mutation', () => {
    const inputs = [
      Object.freeze({ ...base, html: '<p>Body</p>' }),
      Object.freeze({ ...base, text: 'Body' }),
      Object.freeze({ ...base, html: '<p>Body</p>', text: 'Body', replyTo: address }),
      Object.freeze({
        ...base,
        recipients: Object.freeze([
          Object.freeze({ email: address, variables: Object.freeze({ name: 'Test' }) }),
        ]),
        html: '<p>Hello {{name}}</p>',
      }),
    ];
    const before = JSON.stringify(inputs);

    inputs.forEach(assertValidCreateBatchInput);
    expect(JSON.stringify(inputs)).toBe(before);
  });

  it('accepts the documented absolute batch and subject boundaries', () => {
    expect(() => {
      assertValidCreateBatchInput({
        from: sender,
        subject: 'x'.repeat(998),
        recipients: Array.from({ length: 2_000 }, (_, index) => ({
          email: `recipient-${String(index)}@example.test`,
        })),
        text: 'Body',
      });
    }).not.toThrow();
  });

  it.each([
    [null, 'input'],
    [{ ...base, from: '', html: 'Body' }, 'from'],
    [{ ...base, subject: '', html: 'Body' }, 'subject'],
    [{ ...base, subject: 'x'.repeat(999), html: 'Body' }, '998'],
    [{ ...base, recipients: 'not-an-array', html: 'Body' }, 'array'],
    [{ ...base, recipients: [], html: 'Body' }, 'at least one'],
    [
      {
        ...base,
        recipients: Array.from({ length: 2_001 }, () => ({ email: address })),
        html: 'Body',
      },
      'more than 2000',
    ],
    [{ ...base, recipients: [null], html: 'Body' }, 'recipients[0]'],
    [{ ...base, recipients: [{}], html: 'Body' }, 'email'],
    [
      { ...base, recipients: [{ email: address, variables: undefined }], html: 'Body' },
      'variables',
    ],
    [{ ...base, recipients: [{ email: address, variables: [] }], html: 'Body' }, 'variables'],
    [base, 'html, text'],
    [{ ...base, html: '' }, 'input.html'],
    [{ ...base, text: undefined }, 'input.text'],
    [{ ...base, html: 'Body', replyTo: undefined }, 'replyTo'],
    [{ ...base, html: 'Body', attachments: undefined }, 'attachments'],
  ])('rejects invalid batch input %#', (input, message) => {
    expect(() => {
      assertValidCreateBatchInput(input);
    }).toThrow(message);
  });
});

describe('assertValidWaitForBatchOptions', () => {
  it('accepts omission and complete polling controls', () => {
    expect(() => {
      assertValidWaitForBatchOptions(undefined);
    }).not.toThrow();
    expect(() => {
      assertValidWaitForBatchOptions({});
    }).not.toThrow();
    expect(() => {
      assertValidWaitForBatchOptions({
        intervalMs: 1,
        timeoutMs: 60_000,
        returnOnPausedLimit: false,
        signal: new AbortController().signal,
      });
    }).not.toThrow();
  });

  it.each([
    [null, 'options'],
    [{ intervalMs: undefined }, 'intervalMs'],
    [{ intervalMs: -1 }, 'intervalMs'],
    [{ intervalMs: 0 }, 'greater than zero'],
    [{ timeoutMs: Number.NaN }, 'timeoutMs'],
    [{ returnOnPausedLimit: undefined }, 'returnOnPausedLimit'],
    [{ returnOnPausedLimit: 'yes' }, 'returnOnPausedLimit'],
    [{ signal: undefined }, 'signal'],
    [{ signal: {} }, 'AbortSignal'],
    [{ signal: { aborted: false, addEventListener: 'no' } }, 'AbortSignal'],
  ])('rejects invalid polling options %#', (options, message) => {
    expect(() => {
      assertValidWaitForBatchOptions(options);
    }).toThrow(message);
  });
});

describe('assertValidBatchId', () => {
  it('accepts a non-empty identifier', () => {
    expect(() => {
      assertValidBatchId('batch/id');
    }).not.toThrow();
  });

  it.each([undefined, null, '', '   ', 123])('rejects invalid identifier %j', (batchId) => {
    expect(() => {
      assertValidBatchId(batchId);
    }).toThrow('batchId');
  });
});
