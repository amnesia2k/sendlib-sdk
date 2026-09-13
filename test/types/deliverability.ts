import {
  analyzeDeliverability,
  type DeliverabilityInput,
  type DeliverabilityIssueCode,
  type DeliverabilityManualCheckCode,
  type DeliverabilityReport,
} from '../../src/index.js';

export const customInput = {
  to: 'recipient@example.test',
  subject: 'Account update',
  html: '<p>Your account was updated.</p>',
  text: 'Your account was updated.',
} satisfies DeliverabilityInput;

export const templateInput = {
  to: 'recipient@example.test',
  template: 'account-update',
  data: { name: 'Test Recipient' },
} satisfies DeliverabilityInput;

export const batchInput = {
  from: 'Sender <sender@example.test>',
  subject: 'Account updates',
  recipients: [{ email: 'recipient@example.test' }],
  text: 'Your account was updated.',
} satisfies DeliverabilityInput;

export const customReport: DeliverabilityReport = analyzeDeliverability(customInput);
export const templateReport: DeliverabilityReport = analyzeDeliverability(templateInput);
export const batchReport: DeliverabilityReport = analyzeDeliverability(batchInput);

export const issueCode: DeliverabilityIssueCode = 'multiple-links';
export const manualCheckCode: DeliverabilityManualCheckCode = 'expected-recipients';

// @ts-expect-error Deliverability issue codes are a stable closed union.
export const invalidIssueCode: DeliverabilityIssueCode = 'unknown-warning';

// @ts-expect-error A bodyless custom email is not valid analyzer input.
export const invalidInput: DeliverabilityInput = {
  to: 'recipient@example.test',
  subject: 'Missing body',
};

declare const readonlyReport: DeliverabilityReport;

// @ts-expect-error Deliverability reports are readonly.
readonlyReport.passedAutomatedChecks = false;
