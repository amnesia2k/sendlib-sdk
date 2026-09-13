import { Sendlib } from '../../src/index.js';
import type {
  SendEmailResponse,
  SendlibDeliverability,
  SendlibEmails,
  SendlibTemplates,
  TemplateSendInput,
} from '../../src/index.js';

const client = new Sendlib({ apiKey: 'test-only-api-key' });

export const emails: SendlibEmails = client.emails;
export const templates: SendlibTemplates = client.templates;
export const deliverability: SendlibDeliverability = client.deliverability;

export const templateInput = {
  to: 'person@example.test',
  data: { name: 'Person', count: 2 },
} satisfies TemplateSendInput;

export const customResult: Promise<SendEmailResponse> = client.emails.send({
  to: ['first@example.test', 'second@example.test'],
  subject: 'Hello',
  html: '<p>Hello</p>',
});

export const templateResult: Promise<SendEmailResponse> =
  client.templates.verifyEmail(templateInput);

void client.templates.send(
  'custom-dashboard-slug',
  // @ts-expect-error Template namespace input does not repeat the selected slug.
  { ...templateInput, template: 'duplicate' },
);

void client.templates.welcome({
  ...templateInput,
  // @ts-expect-error Template sends cannot provide custom bodies.
  html: '<p>Override</p>',
});
