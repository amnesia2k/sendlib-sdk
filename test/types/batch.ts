import type {
  BatchRecipientStatus,
  BatchStatus,
  BatchStatusResponse,
  CreateBatchInput,
  CreateBatchResponse,
  SendlibBatches,
  WaitForBatchOptions,
} from '../../src/index.js';
import { Sendlib } from '../../src/index.js';

const recipients = [
  { email: 'first@example.test', variables: { name: 'First' } },
  { email: 'second@example.test', variables: { name: 'Second', count: 2 } },
] as const;

export const htmlBatch = {
  from: 'Sender <sender@example.test>',
  subject: 'Service notification for {{name}}',
  recipients,
  html: '<p>Hello {{name}}</p>',
} satisfies CreateBatchInput;

export const textBatch = {
  from: 'sender@example.test',
  subject: 'Service notification',
  recipients,
  text: 'Hello {{name}}',
  replyTo: 'support@example.test',
} satisfies CreateBatchInput;

export const multipartBatch = {
  from: 'sender@example.test',
  subject: 'Service notification',
  recipients,
  html: '<p>Hello {{name}}</p>',
  text: 'Hello {{name}}',
} satisfies CreateBatchInput;

// @ts-expect-error A batch requires at least one of html or text.
export const bodylessBatch: CreateBatchInput = {
  from: 'sender@example.test',
  subject: 'Missing body',
  recipients,
};

export const batchWithAttachment: CreateBatchInput = {
  from: 'sender@example.test',
  subject: 'Unsupported attachment',
  recipients,
  html: '<p>Body</p>',
  // @ts-expect-error SendLib batch requests do not support attachments.
  attachments: [{ filename: 'notice.txt', content: 'VGVzdA==' }],
};

export const documentedBatchStatuses: readonly BatchStatus[] = [
  'queued',
  'processing',
  'paused_limit_reached',
  'done',
  'failed',
];

export const pendingRecipientStatus: BatchRecipientStatus = 'pending';
export const sentRecipientStatus: BatchRecipientStatus = 'sent';
export const futureRecipientStatus: BatchRecipientStatus = 'future-upstream-status';

export const createBatchResponse: CreateBatchResponse = {
  success: true,
  batchId: '64f1a2b3c4d5e6f7a8b9c0d1',
  total: 2,
  status: 'queued',
};

export const batchStatusResponse: BatchStatusResponse = {
  success: true,
  batchId: '64f1a2b3c4d5e6f7a8b9c0d1',
  status: 'processing',
  total: 2,
  sent: 1,
  failed: 0,
  progress: 50,
  recipients: [
    {
      email: 'first@example.test',
      status: 'sent',
      messageId: 'test-message-id',
      error: null,
    },
    {
      email: 'second@example.test',
      status: 'pending',
      messageId: null,
      error: null,
    },
  ],
};

export const defaultWaitOptions: WaitForBatchOptions = {};
export const completeWaitOptions: WaitForBatchOptions = {
  intervalMs: 2_000,
  timeoutMs: 120_000,
  signal: new AbortController().signal,
  returnOnPausedLimit: false,
};

const client = new Sendlib({ apiKey: 'test-only-api-key' });
export const batches: SendlibBatches = client.batches;
export const createResult: Promise<CreateBatchResponse> = client.batches.create(htmlBatch);
export const retrieveResult: Promise<BatchStatusResponse> = client.batches.retrieve('batch-id');
export const waitResult: Promise<BatchStatusResponse> = client.batches.wait(
  'batch-id',
  completeWaitOptions,
);

declare const readonlyBatch: CreateBatchInput;

// @ts-expect-error Public batch input properties are readonly.
readonlyBatch.subject = 'Replacement subject';

// @ts-expect-error Aggregate batch statuses are a documented closed union.
export const invalidBatchStatus: BatchStatus = 'unknown';
