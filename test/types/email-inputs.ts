import type {
  CustomEmailInput,
  EmailAddress,
  SendEmailInput,
  TemplateEmailInput,
} from '../../src/index.js';

export const address: EmailAddress = 'recipient@example.test';

export const minimalCustomEmail = {
  to: address,
  subject: 'Account notification',
  html: '<p>Your account was updated.</p>',
} satisfies CustomEmailInput;

export const completeCustomEmail = {
  from: 'Sender <sender@example.test>',
  to: ['first@example.test', 'second@example.test'] as const,
  subject: 'Account notification',
  html: '<p>Your account was updated.</p>',
  text: 'Your account was updated.',
  replyTo: 'support@example.test',
  cc: 'copy@example.test',
  bcc: ['audit@example.test'] as const,
  attachments: [
    {
      filename: 'notice.txt',
      content: 'VGVzdC1vbmx5IGNvbnRlbnQ=',
      type: 'text/plain',
    },
  ] as const,
} satisfies CustomEmailInput;

export const templateEmail = {
  from: 'sender@example.test',
  to: address,
  template: 'account-notification',
  data: {
    name: 'Test Recipient',
    metadata: { source: 'type-test' },
  },
} satisfies TemplateEmailInput;

export const customAsSendInput: SendEmailInput = minimalCustomEmail;
export const templateAsSendInput: SendEmailInput = templateEmail;

export function selectContent(input: SendEmailInput): string {
  if (input.template !== undefined) return input.template;
  return input.subject;
}

// @ts-expect-error Documented custom sends require an HTML body.
export const customWithoutHtml: CustomEmailInput = {
  to: address,
  subject: 'Missing body',
};

export const templateWithSubject: TemplateEmailInput = {
  to: address,
  template: 'account-notification',
  data: {},
  // @ts-expect-error Template subject overrides are not documented.
  subject: 'Unsupported override',
};

export const templateWithMultipleRecipients: TemplateEmailInput = {
  // @ts-expect-error Template sends only document one recipient.
  to: ['first@example.test', 'second@example.test'],
  template: 'account-notification',
  data: {},
};

// @ts-expect-error Template sends require a data object.
export const templateWithoutData: TemplateEmailInput = {
  to: address,
  template: 'account-notification',
};

// @ts-expect-error SendEmailInput rejects mixed custom and template modes.
export const mixedEmail: SendEmailInput = {
  to: address,
  template: 'account-notification',
  data: {},
  subject: 'Unsupported override',
  html: '<p>Unsupported override</p>',
};

declare const readonlyCustomEmail: CustomEmailInput;

// @ts-expect-error Public input properties are readonly.
readonlyCustomEmail.subject = 'Replacement subject';
