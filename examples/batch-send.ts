import { Sendlib, SendlibPlanRequiredError } from '@sendlib/node-sdk';

function requiredEnvironment(name: string): string {
  const value = process.env[name];
  if (value === undefined || value.trim().length === 0) throw new Error(`${name} is required`);
  return value;
}

if (process.env.SENDLIB_RUN_EXAMPLE !== 'true') {
  throw new Error('Set SENDLIB_RUN_EXAMPLE=true only when you intend to send a real batch.');
}

const sendlib = new Sendlib({ apiKey: requiredEnvironment('SENDLIB_API_KEY') });

try {
  // Batch sending is Pro-only and does not support attachments.
  const created = await sendlib.batches.create({
    from: requiredEnvironment('SENDLIB_EXAMPLE_SENDER'),
    subject: 'Service update for {{name}}',
    recipients: [
      {
        email: requiredEnvironment('SENDLIB_EXAMPLE_RECIPIENT'),
        variables: { name: 'Ada' },
      },
    ],
    html: '<p>Hello {{name}}, your service update is ready.</p>',
    text: 'Hello {{name}}, your service update is ready.',
  });

  // `wait` polls only the returned ID; it never submits the batch again.
  const finalStatus = await sendlib.batches.wait(created.batchId, {
    intervalMs: 1_000,
    timeoutMs: 60_000,
  });
  console.log('Batch polling stopped.', finalStatus.status, {
    failed: finalStatus.failed,
    sent: finalStatus.sent,
    total: finalStatus.total,
  });
} catch (error: unknown) {
  if (error instanceof SendlibPlanRequiredError) {
    console.error('This SendLib account needs a Pro plan for batch sending.');
  } else {
    throw error;
  }
}
