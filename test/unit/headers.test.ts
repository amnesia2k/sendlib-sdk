import { describe, expect, it } from 'vitest';

import { createRequestHeaders } from '../../src/internal/headers.js';

describe('createRequestHeaders', () => {
  it('creates the default Bearer headers without a content type for bodyless requests', () => {
    const headers = createRequestHeaders({
      apiKey: 'test-only-api-key',
      authMode: 'bearer',
      hasJsonBody: false,
    });

    expect(Object.fromEntries(headers)).toEqual({
      accept: 'application/json',
      authorization: 'Bearer test-only-api-key',
    });
  });

  it('creates x-api-key and JSON content headers for requests with a body', () => {
    const headers = createRequestHeaders({
      apiKey: 'test-only-api-key',
      authMode: 'x-api-key',
      hasJsonBody: true,
    });

    expect(Object.fromEntries(headers)).toEqual({
      accept: 'application/json',
      'content-type': 'application/json',
      'x-api-key': 'test-only-api-key',
    });
  });
});
