import type { SendlibAuthMode } from '../types.js';

export interface RequestHeaderOptions {
  readonly apiKey: string;
  readonly authMode: SendlibAuthMode;
  readonly hasJsonBody: boolean;
}

/** Build the complete header set for a SendLib API request. */
export function createRequestHeaders(options: RequestHeaderOptions): Headers {
  const headers = new Headers({ Accept: 'application/json' });

  if (options.hasJsonBody) {
    headers.set('Content-Type', 'application/json');
  }

  if (options.authMode === 'x-api-key') {
    headers.set('x-api-key', options.apiKey);
  } else {
    headers.set('Authorization', `Bearer ${options.apiKey}`);
  }

  return headers;
}
