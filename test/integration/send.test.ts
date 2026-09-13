import { describe, expect, it } from 'vitest';

import { Sendlib } from '../../src/index.js';

const enabled = process.env.SENDLIB_RUN_INTEGRATION_TESTS === 'true';
const describeLive = enabled ? describe : describe.skip;

function requiredEnvironment(name: string): string {
  const value = process.env[name];
  if (value === undefined || value.trim().length === 0) {
    throw new Error(`${name} is required when SENDLIB_RUN_INTEGRATION_TESTS=true`);
  }
  return value;
}

describeLive('controlled SendLib sends', () => {
  it('sends one custom message to the approved test recipient', async () => {
    const client = new Sendlib({
      apiKey: requiredEnvironment('SENDLIB_API_KEY'),
      maxRetries: 0,
    });
    const recipient = requiredEnvironment('SENDLIB_TEST_RECIPIENT');
    const sender = process.env.SENDLIB_TEST_SENDER;
    const response = await client.emails.send({
      ...(sender === undefined ? {} : { from: sender }),
      to: recipient,
      subject: 'Sendlib Node SDK controlled integration test',
      html: '<p>This is a controlled integration test from @sendlib/node-sdk.</p>',
      text: 'This is a controlled integration test from @sendlib/node-sdk.',
    });

    expect(response).toBeDefined();
  });

  it('sends one dedicated dashboard template to the approved test recipient', async () => {
    const client = new Sendlib({
      apiKey: requiredEnvironment('SENDLIB_API_KEY'),
      maxRetries: 0,
    });
    const recipient = requiredEnvironment('SENDLIB_TEST_RECIPIENT');
    const sender = process.env.SENDLIB_TEST_SENDER;
    const response = await client.templates.send(requiredEnvironment('SENDLIB_TEST_TEMPLATE'), {
      ...(sender === undefined ? {} : { from: sender }),
      to: recipient,
      data: { sdkIntegrationTest: true },
    });

    expect(response).toBeDefined();
  });
});
