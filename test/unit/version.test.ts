import { describe, expect, it } from 'vitest';

import { VERSION } from '../../src/index.js';

describe('VERSION', () => {
  it('matches the initial package version', () => {
    expect(VERSION).toBe('0.1.0');
  });
});
