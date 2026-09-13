import type { SendEmailResponse } from '../../src/index.js';

export const responseWithoutAssumedFields = {} satisfies SendEmailResponse;

export const responseWithDebug = {
  debug: {
    issues: [],
  },
} satisfies SendEmailResponse;

export const responseWithUnknownFields = {
  success: true,
  messageId: 'test-message-id',
  futureField: { nested: 'preserved' },
  debug: {
    issues: ['warning text', { futureShape: true }, null],
    score: 80,
  },
} satisfies SendEmailResponse;

export const invalidIssues: SendEmailResponse = {
  debug: {
    // @ts-expect-error The documented issues container is an array.
    issues: 'not-an-array',
  },
};

declare const parsedResponse: SendEmailResponse;

export const unverifiedMessageId: unknown = parsedResponse.messageId;
export const unverifiedIssue: unknown = parsedResponse.debug?.issues?.[0];

// @ts-expect-error Parsed response fields are readonly.
parsedResponse.messageId = 'replacement-id';
