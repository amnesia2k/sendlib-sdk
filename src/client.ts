import { analyzeDeliverability } from './deliverability.js';
import { createBatches } from './batches.js';
import { SendlibConfigError, SendlibValidationError } from './errors.js';
import { sendlibRequest } from './internal/transport.js';
import {
  assertValidSendEmailInput,
  assertValidSendlibCallOptions,
  assertValidSendlibOptions,
} from './internal/validation.js';
import type {
  CustomEmailInput,
  SendEmailInput,
  SendEmailResponse,
  SendlibCallOptions,
  SendlibOptions,
  TemplateEmailInput,
  TemplateSendInput,
} from './types.js';
import type { DeliverabilityInput, DeliverabilityReport } from './deliverability.js';
import type { SendlibBatches } from './batches.js';

/** Immediate email operations exposed by {@link Sendlib}. */
export interface SendlibEmails {
  /** Send custom content or a dashboard template through `POST /api/send`. */
  send(input: SendEmailInput, options?: SendlibCallOptions): Promise<SendEmailResponse>;
}

/** Dashboard template operations exposed by {@link Sendlib}. */
export interface SendlibTemplates {
  /** Send any current or future dashboard template slug. */
  send(
    template: string,
    input: TemplateSendInput,
    options?: SendlibCallOptions,
  ): Promise<SendEmailResponse>;
  welcome(input: TemplateSendInput, options?: SendlibCallOptions): Promise<SendEmailResponse>;
  verifyEmail(input: TemplateSendInput, options?: SendlibCallOptions): Promise<SendEmailResponse>;
  passwordReset(input: TemplateSendInput, options?: SendlibCallOptions): Promise<SendEmailResponse>;
  otp(input: TemplateSendInput, options?: SendlibCallOptions): Promise<SendEmailResponse>;
  invoice(input: TemplateSendInput, options?: SendlibCallOptions): Promise<SendEmailResponse>;
  paymentSuccessful(
    input: TemplateSendInput,
    options?: SendlibCallOptions,
  ): Promise<SendEmailResponse>;
  paymentFailed(input: TemplateSendInput, options?: SendlibCallOptions): Promise<SendEmailResponse>;
  subscriptionExpiring(
    input: TemplateSendInput,
    options?: SendlibCallOptions,
  ): Promise<SendEmailResponse>;
  accountSuspended(
    input: TemplateSendInput,
    options?: SendlibCallOptions,
  ): Promise<SendEmailResponse>;
}

/** Non-blocking local deliverability tools exposed by {@link Sendlib}. */
export interface SendlibDeliverability {
  analyze(input: DeliverabilityInput): DeliverabilityReport;
}

function validateConfiguration(options: unknown): asserts options is SendlibOptions {
  try {
    assertValidSendlibOptions(options);
  } catch (error) {
    throw new SendlibConfigError((error as Error).message, {
      cause: error,
    });
  }
}

function validateSend(input: unknown, options: unknown): asserts input is SendEmailInput {
  try {
    assertValidSendEmailInput(input);
    assertValidSendlibCallOptions(options);
  } catch (error) {
    throw new SendlibValidationError((error as Error).message, {
      cause: error,
    });
  }
}

function customPayload(input: CustomEmailInput): CustomEmailInput {
  return {
    ...(input.from === undefined ? {} : { from: input.from }),
    to: input.to,
    subject: input.subject,
    html: input.html,
    ...(input.text === undefined ? {} : { text: input.text }),
    ...(input.replyTo === undefined ? {} : { replyTo: input.replyTo }),
    ...(input.cc === undefined ? {} : { cc: input.cc }),
    ...(input.bcc === undefined ? {} : { bcc: input.bcc }),
    ...(input.attachments === undefined ? {} : { attachments: input.attachments }),
  };
}

function templatePayload(input: TemplateEmailInput): TemplateEmailInput {
  return {
    ...(input.from === undefined ? {} : { from: input.from }),
    to: input.to,
    template: input.template,
    data: input.data,
  };
}

function isTemplateInput(input: SendEmailInput): input is TemplateEmailInput {
  return 'template' in input;
}

class Emails implements SendlibEmails {
  constructor(private readonly clientOptions: SendlibOptions) {}

  async send(input: SendEmailInput, options?: SendlibCallOptions): Promise<SendEmailResponse> {
    validateSend(input, options);
    const body = isTemplateInput(input) ? templatePayload(input) : customPayload(input);
    const response = await sendlibRequest<SendEmailResponse>(this.clientOptions, {
      method: 'POST',
      path: '/api/send',
      feature: 'email',
      body,
      ...(options?.signal === undefined ? {} : { signal: options.signal }),
      ...(options?.timeoutMs === undefined ? {} : { timeoutMs: options.timeoutMs }),
    });

    return response.body;
  }
}

class Templates implements SendlibTemplates {
  constructor(private readonly emails: SendlibEmails) {}

  send(
    template: string,
    input: TemplateSendInput,
    options?: SendlibCallOptions,
  ): Promise<SendEmailResponse> {
    return this.emails.send({ ...input, template }, options);
  }

  welcome(input: TemplateSendInput, options?: SendlibCallOptions): Promise<SendEmailResponse> {
    return this.send('welcome', input, options);
  }

  verifyEmail(input: TemplateSendInput, options?: SendlibCallOptions): Promise<SendEmailResponse> {
    return this.send('verify-email', input, options);
  }

  passwordReset(
    input: TemplateSendInput,
    options?: SendlibCallOptions,
  ): Promise<SendEmailResponse> {
    return this.send('password-reset', input, options);
  }

  otp(input: TemplateSendInput, options?: SendlibCallOptions): Promise<SendEmailResponse> {
    return this.send('otp', input, options);
  }

  invoice(input: TemplateSendInput, options?: SendlibCallOptions): Promise<SendEmailResponse> {
    return this.send('invoice', input, options);
  }

  paymentSuccessful(
    input: TemplateSendInput,
    options?: SendlibCallOptions,
  ): Promise<SendEmailResponse> {
    return this.send('payment-successful', input, options);
  }

  paymentFailed(
    input: TemplateSendInput,
    options?: SendlibCallOptions,
  ): Promise<SendEmailResponse> {
    return this.send('payment-failed', input, options);
  }

  subscriptionExpiring(
    input: TemplateSendInput,
    options?: SendlibCallOptions,
  ): Promise<SendEmailResponse> {
    return this.send('subscription-expiring', input, options);
  }

  accountSuspended(
    input: TemplateSendInput,
    options?: SendlibCallOptions,
  ): Promise<SendEmailResponse> {
    return this.send('account-suspended', input, options);
  }
}

/** Unofficial community client for the SendLib transactional email API. */
export class Sendlib {
  readonly batches: SendlibBatches;
  readonly emails: SendlibEmails;
  readonly templates: SendlibTemplates;
  readonly deliverability: SendlibDeliverability;

  constructor(options: SendlibOptions) {
    validateConfiguration(options);
    const clientOptions = Object.freeze({ ...options });
    this.batches = createBatches(clientOptions);
    this.emails = Object.freeze(new Emails(clientOptions));
    this.templates = Object.freeze(new Templates(this.emails));
    this.deliverability = Object.freeze({ analyze: analyzeDeliverability });
  }
}
