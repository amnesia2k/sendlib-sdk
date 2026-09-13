import { describe, expect, it } from 'vitest';

import { Sendlib } from '../../src/index.js';

const enabled =
  process.env.SENDLIB_RUN_INTEGRATION_TESTS === 'true' &&
  process.env.SENDLIB_RUN_BATCH_INTEGRATION_TESTS === 'true';
const describeLive = enabled ? describe : describe.skip;

function requiredEnvironment(name: string): string {
  const value = process.env[name];
  if (value === undefined || value.trim().length === 0) {
    throw new Error(`${name} is required for the controlled Pro batch integration test`);
  }
  return value;
}

describeLive('controlled SendLib Pro batch flow', () => {
  it('creates one tiny approved batch and polls that same batch to completion', async () => {
    const client = new Sendlib({
      apiKey: requiredEnvironment('SENDLIB_API_KEY'),
      maxRetries: 2,
    });
    const created = await client.batches.create({
      from: requiredEnvironment('SENDLIB_TEST_SENDER'),
      subject: 'Sendlib Node SDK controlled batch integration test',
      recipients: [{ email: requiredEnvironment('SENDLIB_TEST_RECIPIENT') }],
      html: '<p>This is a controlled batch integration test from @sendlib/node-sdk.</p>',
      text: 'This is a controlled batch integration test from @sendlib/node-sdk.',
    });

    expect(created.status).toBe('queued');
    const completed = await client.batches.wait(created.batchId, {
      intervalMs: 1_000,
      returnOnPausedLimit: false,
      timeoutMs: 120_000,
    });
    expect(completed.status).toBe('done');
  });
});
