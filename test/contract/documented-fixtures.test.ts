import { readFile } from 'node:fs/promises';

import { describe, expect, it } from 'vitest';

async function readFixture(name: string): Promise<unknown> {
  const fixtureUrl = new URL(`../fixtures/contracts/${name}`, import.meta.url);
  return JSON.parse(await readFile(fixtureUrl, 'utf8')) as unknown;
}

describe('documented SendLib batch fixtures', () => {
  it('preserves the published batch-create response', async () => {
    await expect(readFixture('batch-create.success.json')).resolves.toEqual({
      success: true,
      batchId: '64f1a2b3c4d5e6f7a8b9c0d1',
      total: 2,
      status: 'queued',
    });
  });

  it('preserves the published processing response', async () => {
    const fixture = await readFixture('batch-status.processing.json');

    expect(fixture).toMatchObject({
      success: true,
      status: 'processing',
      total: 2,
      sent: 1,
      failed: 0,
      progress: 50,
      recipients: [
        { email: 'john@example.com', status: 'sent' },
        { email: 'jane@example.com', status: 'pending' },
      ],
    });
  });
});
