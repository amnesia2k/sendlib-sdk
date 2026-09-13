import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { VERSION } from '../../src/index.js';

const manifest = JSON.parse(
  readFileSync(new URL('../../package.json', import.meta.url), 'utf8'),
) as { version: string };

describe('VERSION', () => {
  it('matches the package version', () => {
    expect(VERSION).toBe(manifest.version);
  });
});
