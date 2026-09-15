# SendLib Node.js SDK

> [!IMPORTANT]
> `@sendlib/node-sdk` is an independent, community-maintained SDK and is not an official SendLib product. Contributors may include people affiliated with SendLib, but an individual's contribution does not by itself mean that SendLib officially sponsors, endorses, maintains, or supports this package. Report SDK problems to this project's [issue tracker](https://github.com/amnesia2k/sendlib-sdk/issues). SendLib account, Gmail connection, billing, quota, and service questions belong with [SendLib's official documentation and support](https://sendlib.samueltuoyo.com/docs).

A typed, server-side Node.js SDK for SendLib's transactional email API, with custom email, dashboard-template, Pro batch, bounded polling, error, retry, cancellation, and deliverability helpers.

## Status

`@sendlib/node-sdk` publishes approved releases under npm's `latest` tag. The project is currently in the `0.x` release line, so review the changelog before upgrading a minor version. Confirm the package name and available versions on npm before installing; do not use similarly named packages.

- Source: [github.com/amnesia2k/sendlib-sdk](https://github.com/amnesia2k/sendlib-sdk)
- SDK issues: [GitHub Issues](https://github.com/amnesia2k/sendlib-sdk/issues)
- SendLib API docs: [sendlib.samueltuoyo.com/docs](https://sendlib.samueltuoyo.com/docs)
- Security: [SECURITY.md](./SECURITY.md)
- Support boundaries: [SUPPORT.md](./SUPPORT.md)
- API evidence and known gaps: [CONTRACT.md](./CONTRACT.md)

## New here? Read these sections first

You do not need to understand every feature before sending your first email.

1. [Install the package](#installation).
2. [Connect Gmail and create an API key](#sendlib-account-setup).
3. [Set the environment variable](#environment-variables).
4. [Send the quick-start email](#quick-start-recommended-for-most-users).

After that, read only the section you need: [attachments](#attachments), [dashboard templates](#dashboard-templates), or [Pro batch sending](#pro-batch-sending). Advanced configuration and retries can usually be left at their defaults.

## Features

- Custom HTML email with an optional plain-text fallback.
- String or array recipients, CC, BCC, Reply-To, display-name senders, and base64 attachments.
- Generic dashboard-template sending and shortcuts for all documented starter templates.
- Pro batch creation, status retrieval, and bounded polling.
- Bearer authentication by default and optional `x-api-key` authentication.
- Typed configuration, inputs, responses, and public error classes.
- Per-request timeouts, `AbortSignal` cancellation, and safe GET retries.
- Local, non-blocking deliverability analysis based on SendLib's published guidance.
- ESM and CommonJS builds with no runtime dependencies.

## Requirements and compatibility

| Capability              | Support                                            |
| ----------------------- | -------------------------------------------------- |
| Node.js                 | `>=22`                                             |
| ESM                     | Yes, using `import`                                |
| CommonJS                | Yes, using `require`                               |
| TypeScript              | Bundled declarations for ESM and CommonJS          |
| Bun applications        | Supported as a Node-compatible runtime             |
| Browser/client-side use | Not supported; it would expose the SendLib API key |
| Runtime dependencies    | None                                               |

The SDK uses the runtime's built-in Fetch API. Bun is the package manager used to develop this repository, but applications may install the published package with npm or Bun.

In this README, **client** means the reusable `Sendlib` object created inside your server. It does not mean browser-side or React client code. The SDK must stay in server code such as Express handlers, NestJS providers, Next.js Route Handlers or Server Actions, workers, and background jobs.

If your project uses `import`, follow the ESM examples in this README. If it uses `require`, use the short CommonJS example below. You do not need to learn both module formats.

## Small terminology guide

| Term          | Plain-language meaning                                                                    |
| ------------- | ----------------------------------------------------------------------------------------- |
| SDK client    | The `Sendlib` object your server reuses to call the SendLib API. It is not frontend code. |
| API key       | A secret password used by your server to authenticate with SendLib.                       |
| Template      | An email design/content definition that already exists in your SendLib dashboard.         |
| Template slug | The template's short identifier, such as `password-reset`.                                |
| Template data | Values inserted into placeholders such as `{{name}}` or `{{code}}`.                       |
| Batch         | One background job that sends personalized email to many recipients. It requires Pro.     |
| Polling       | Repeatedly asking SendLib whether a batch is still running or has finished.               |

## Installation

There are two different setup paths: application developers install the package, while contributors clone this repository.

### Install the SDK in your application

Use one of these commands inside the server-side Node.js application that will send email. The package must first be published to npm.

```sh
npm install @sendlib/node-sdk
```

Or, if your application uses Bun:

```sh
bun add @sendlib/node-sdk
```

You do not need to clone this repository to use the SDK in your application.

### Clone the repository to contribute

Use this path only when you want to change the SDK, run its complete development checks, or open a pull request. This repository uses Bun for development.

```sh
git clone https://github.com/amnesia2k/sendlib-sdk.git
cd sendlib-sdk/sendlib-node-sdk
bun install --frozen-lockfile
bun run ci
```

Cloning the repository does not install `@sendlib/node-sdk` into another application and does not publish anything to npm.
Contributors should also run `bun run security:scan` before opening a pull request; it scans both the repository and a freshly packed artifact without printing suspected credential values.

## SendLib account setup

Before sending email:

1. Create or sign in to your SendLib account.
2. Follow SendLib's [Gmail connection guide](https://sendlib.samueltuoyo.com/docs/gmail) to connect the account that will send mail.
3. Create an API key using SendLib's [API key guide](https://sendlib.samueltuoyo.com/docs/keys).
4. Store the key in your server or deployment platform's secret manager.
5. Never commit the key or expose it in frontend JavaScript.

If several Gmail accounts are connected, provide `from` explicitly. The public docs say SendLib can select the first connected account when `from` is omitted, but relying on that behavior can choose the wrong sender in a multi-account application.

## Environment variables

Create a local `.env` file that is ignored by Git:

```dotenv
SENDLIB_API_KEY=sl_your_api_key_here
```

The SDK deliberately does not load `.env` files. Libraries should not choose an application's configuration loader, mutate global environment state, or add a runtime dependency for this. Load environment variables through your runtime or framework, then pass the value explicitly.

Node.js can load a local file itself:

```sh
node --env-file=.env server.js
```

Validate configuration at application startup:

```ts
import { Sendlib } from '@sendlib/node-sdk';

const apiKey = process.env.SENDLIB_API_KEY;
if (!apiKey) {
  throw new Error('SENDLIB_API_KEY is required');
}

export const sendlib = new Sendlib({ apiKey });
```

Do not use a public-prefixed environment variable such as `NEXT_PUBLIC_SENDLIB_API_KEY` or `VITE_SENDLIB_API_KEY`. Those names are commonly embedded into browser bundles.

## Quick start (recommended for most users)

This is the normal server-side setup for Express, plain Node.js, Next.js server code, NestJS, jobs, and workers. It is not a React/browser example.

```ts
import { Sendlib } from '@sendlib/node-sdk';

const apiKey = process.env.SENDLIB_API_KEY;
if (!apiKey) throw new Error('SENDLIB_API_KEY is required');

const sendlib = new Sendlib({ apiKey });

const response = await sendlib.emails.send({
  to: 'recipient@example.com',
  subject: 'Your account update',
  html: '<p>Your requested account update is ready.</p>',
  text: 'Your requested account update is ready.',
});

// SendLib does not publish a complete success schema. Known and future fields
// are preserved, while `debug.issues` is typed as an optional unknown array.
console.log('Debug issue count:', response.debug?.issues?.length ?? 0);
```

If your server uses CommonJS `require` instead of `import`, initialize the same SDK this way:

```js
const { Sendlib } = require('@sendlib/node-sdk');

const sendlib = new Sendlib({ apiKey: process.env.SENDLIB_API_KEY });
```

## Advanced SDK configuration

Most users only need `new Sendlib({ apiKey })`. This section configures the same server-side SDK object shown in Quick start; it is not configuration for a browser or React client.

```ts
import { Sendlib } from '@sendlib/node-sdk';

const apiKey = process.env.SENDLIB_API_KEY;
if (!apiKey) throw new Error('SENDLIB_API_KEY is required');

const sendlib = new Sendlib({
  apiKey,
  authMode: 'bearer',
  timeoutMs: 30_000,
  maxRetries: 2,
});
```

| Option       | Type                      | Default    | Behavior                                                      |
| ------------ | ------------------------- | ---------- | ------------------------------------------------------------- |
| `apiKey`     | `string`                  | Required   | Sent only in the selected authentication header.              |
| `authMode`   | `'bearer' \| 'x-api-key'` | `'bearer'` | Uses `Authorization: Bearer …` or `x-api-key`.                |
| `timeoutMs`  | `number`                  | `30000`    | Maximum duration of each HTTP attempt.                        |
| `maxRetries` | `number`                  | `2`        | Retries after the first attempt for safe GET operations only. |

Configuration is validated and snapshotted by the constructor. Changing the original options object later does not change the client.

## Sending custom email

SendLib's documented custom mode requires `subject` and `html`. `text` is an optional fallback; this SDK does not advertise undocumented text-only custom sends.

### HTML and plain text

```ts
const response = await sendlib.emails.send({
  // Display-name format is forwarded exactly as supplied.
  from: '"Alex at Example" <alex@example.com>',
  to: ['first@example.com', 'second@example.com'],
  subject: 'Quick update regarding your connection',
  html: '<p>You can restore your connection from your dashboard.</p>',
  text: 'You can restore your connection from your dashboard.',
});
```

The SDK does not rewrite subjects, HTML, text, addresses, or display names.

### CC, BCC, and Reply-To

- `to` contains the main recipient or recipients.
- `cc` sends visible copies; recipients can normally see the other CC addresses.
- `bcc` sends hidden copies; recipients cannot see the BCC addresses.
- `replyTo` controls the address used when a recipient clicks Reply.

```ts
await sendlib.emails.send({
  from: '"Example Support" <support@example.com>',
  to: 'customer@example.com',
  cc: ['account-owner@example.com'],
  bcc: 'audit@example.com',
  replyTo: 'helpdesk@example.com',
  subject: 'Your support update',
  html: '<p>We updated your support request.</p>',
  text: 'We updated your support request.',
});
```

SendLib documents a maximum of 50 addresses independently for `to`, `cc`, and `bcc` on immediate sends.

`bcc` may contain one address or an array, but it is still part of one immediate email request. It is not a replacement for Pro batch sending:

| Need                                                | Use       |
| --------------------------------------------------- | --------- |
| Send the same email to a few hidden recipients      | `bcc`     |
| Personalize values for each recipient               | Pro batch |
| Track background progress and per-recipient results | Pro batch |
| Send to hundreds or thousands of recipients         | Pro batch |

```ts
await sendlib.emails.send({
  to: 'customer@example.com',
  bcc: ['audit@example.com', 'records@example.com'],
  subject: 'Payment received',
  html: '<p>Your payment was received.</p>',
});
```

## Attachments

SendLib expects base64 content without a `data:` URL prefix. The SDK forwards the value without decoding or re-encoding it.

```ts
import { readFile } from 'node:fs/promises';

const pdf = await readFile('./invoice.pdf');

await sendlib.emails.send({
  to: 'customer@example.com',
  subject: 'Your invoice',
  html: '<p>Your invoice is attached.</p>',
  text: 'Your invoice is attached.',
  attachments: [
    {
      filename: 'invoice.pdf',
      content: pdf.toString('base64'),
      type: 'application/pdf',
    },
  ],
});
```

Current documented attachment limits:

| Plan | File count | Per-file limit |
| ---- | ---------: | -------------: |
| Free |          5 |           1 MB |
| Pro  |         20 |          10 MB |

Gmail also enforces an approximately 25 MB total message limit. Base64 increases the size of binary data, so check the encoded request size as well as the source file. Batch sends do not support attachments.

## Dashboard templates

Templates must already exist in the SendLib dashboard. This SDK selects them; it does not fetch, create, edit, render, or delete templates.

There are two ways to select a template. Both call the same SendLib endpoint and produce the same kind of email:

| Usage                                                        | Choose it when                                                                                                           |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------ |
| `sendlib.templates.send('slug', input)`                      | You created a custom dashboard template, store its slug in configuration, or need a future template unknown to this SDK. |
| `sendlib.templates.passwordReset(input)` and other shortcuts | You use one of SendLib's nine documented starter templates and want autocomplete without typing its slug.                |

The shortcuts do not contain or render template HTML. For example, `passwordReset(input)` is simply the convenient equivalent of `send('password-reset', input)`.

### Any dashboard template (provide the slug)

```ts
await sendlib.templates.send('my-dashboard-slug', {
  from: '"Example App" <app@example.com>', // Optional with one connected account.
  to: 'recipient@example.com',
  data: {
    name: 'Ada',
    nestedValue: { enabled: true },
  },
});
```

Template `data` is `Readonly<Record<string, unknown>>`. SendLib's examples use strings, but it does not publish an exhaustive value-type contract. Values are serialized without SDK coercion, and the dashboard template remains authoritative for required variables.

### Starter-template shortcuts (slug selected for you)

```ts
await sendlib.templates.passwordReset({
  to: 'recipient@example.com',
  data: { name: 'Ada', code: '482921' },
});
```

The current variable names below are hints from SendLib's documentation, not fixed SDK requirements. Users can edit dashboard templates.

| SDK method             | SendLib slug            | Currently documented variables         |
| ---------------------- | ----------------------- | -------------------------------------- |
| `welcome`              | `welcome`               | `name`, `product`                      |
| `verifyEmail`          | `verify-email`          | `name`, `link`                         |
| `passwordReset`        | `password-reset`        | `name`, `code`                         |
| `otp`                  | `otp`                   | `name`, `code`                         |
| `invoice`              | `invoice`               | `name`, `amount`, `invoice_id`, `date` |
| `paymentSuccessful`    | `payment-successful`    | `name`, `amount`, `product`            |
| `paymentFailed`        | `payment-failed`        | `name`, `amount`, `retry_url`          |
| `subscriptionExpiring` | `subscription-expiring` | `name`, `plan`, `date`                 |
| `accountSuspended`     | `account-suspended`     | `name`, `reason`, `support_url`        |

The lower-level equivalent remains available:

```ts
await sendlib.emails.send({
  template: 'password-reset',
  to: 'recipient@example.com',
  data: { name: 'Ada', code: '482921' },
});
```

Missing variables are reported by SendLib as an HTTP `400`. Because no stable error-body schema is published, inspect `SendlibApiError.body` with application-specific narrowing.

## Pro batch sending

> [!WARNING]
> Batch sending is a SendLib Pro feature. It does not support attachments. The SDK cannot inspect or upgrade an account's plan.

A batch is useful when many recipients need their own values, such as a different `name`, invoice number, or account link. SendLib queues the work in the background, immediately returns a `batchId`, and lets your application check that ID for progress. For a small number of identical hidden copies, use `bcc` instead.

### Create a batch

```ts
const created = await sendlib.batches.create({
  from: '"Example Operations" <operations@example.com>',
  subject: 'Service update for {{name}}',
  recipients: [
    { email: 'ada@example.com', variables: { name: 'Ada' } },
    { email: 'grace@example.com', variables: { name: 'Grace' } },
  ],
  html: '<p>Hello {{name}}, your service update is ready.</p>',
  text: 'Hello {{name}}, your service update is ready.',
  replyTo: 'support@example.com',
});

console.log(created.batchId, created.total, created.status); // queued
```

The creation POST is never automatically retried. This prevents an ambiguous network failure from creating duplicate email work when SendLib provides no documented idempotency key.

### Retrieve status once

Use `retrieve` when your application wants one current snapshot and will decide later whether to check again.

```ts
const status = await sendlib.batches.retrieve(created.batchId);

console.log(status.status, status.progress, status.sent, status.failed);
// `status.recipients` preserves each status, messageId, and unknown error.
// Store those details securely instead of placing addresses in ordinary logs.
```

Recipient statuses currently demonstrated by SendLib are `pending` and `sent`; unknown future strings and non-null recipient errors are preserved.

### Wait until polling should stop

Use `wait` when the current process can remain active while the SDK checks repeatedly. A finite deadline prevents it from checking forever.

```ts
const finalStatus = await sendlib.batches.wait(created.batchId, {
  intervalMs: 1_000,
  timeoutMs: 60_000,
  // The default is true: return so your app can persist state and resume later.
  returnOnPausedLimit: true,
});

if (finalStatus.status === 'paused_limit_reached') {
  console.log('Gmail quota paused this batch; SendLib will resume it later.');
} else {
  console.log('Batch completed.', finalStatus.sent, finalStatus.failed);
}
```

The polling lifecycle is:

```text
Create the batch once: POST /api/batch
                  |
                  v
         Receive queued batchId
                  |
                  v
Retrieve status: GET /api/batch/:batchId
                  |
                  +-- queued or processing --> wait --> retrieve again
                  |
                  +-- done ------------------> return final response
                  |
                  +-- failed ----------------> throw SendlibBatchFailedError
                  |
                  +-- paused_limit_reached --> return status by default
                  |
                  +-- deadline -------------> throw SendlibBatchWaitTimeoutError
                  |
                  +-- caller abort ----------> throw SendlibAbortError
```

The overall deadline also cancels active GET attempts and retry delays. `wait` never submits another batch.

### Free-plan handling

```ts
import { SendlibPlanRequiredError } from '@sendlib/node-sdk';

try {
  await sendlib.batches.create({
    from: 'sender@example.com',
    subject: 'Account update',
    recipients: [{ email: 'recipient@example.com' }],
    text: 'Your account update is ready.',
  });
} catch (error: unknown) {
  if (error instanceof SendlibPlanRequiredError) {
    console.error(error.status); // 403
    console.error(error.feature); // 'batch'
    console.error(error.requiredPlan); // 'pro'
  } else {
    throw error;
  }
}
```

All documented and undocumented batch `403` body shapes map to the same safe error. The raw upstream body remains available as non-enumerable `unknown` diagnostics.

## Errors

Every intentional SDK error extends `SendlibError`.

For a first integration, start by handling `SendlibValidationError`, `SendlibAuthenticationError`, `SendlibRateLimitError`, and the general `SendlibApiError`. The more specific timeout, cancellation, and batch errors become useful when your application needs separate recovery behavior.

| Error                          | Meaning                                             |
| ------------------------------ | --------------------------------------------------- |
| `SendlibConfigError`           | Invalid client configuration.                       |
| `SendlibValidationError`       | Locally detectable invalid request or call options. |
| `SendlibAuthenticationError`   | HTTP `401`; missing or invalid API key.             |
| `SendlibForbiddenError`        | General HTTP `403`.                                 |
| `SendlibPlanRequiredError`     | Batch HTTP `403`; SendLib Pro is required.          |
| `SendlibPayloadTooLargeError`  | HTTP `413`.                                         |
| `SendlibRateLimitError`        | HTTP `429`, with optional `retryAfterMs`.           |
| `SendlibApiError`              | Another non-success SendLib HTTP response.          |
| `SendlibTimeoutError`          | One HTTP attempt exceeded its timeout.              |
| `SendlibAbortError`            | The caller cancelled an operation.                  |
| `SendlibNetworkError`          | No SendLib HTTP response was available.             |
| `SendlibBatchFailedError`      | A batch reached the terminal `failed` state.        |
| `SendlibBatchWaitTimeoutError` | The overall batch polling deadline expired.         |

Handle specific errors before their base classes:

```ts
import {
  SendlibApiError,
  SendlibAuthenticationError,
  SendlibRateLimitError,
  SendlibValidationError,
} from '@sendlib/node-sdk';

try {
  await sendlib.emails.send({
    to: 'recipient@example.com',
    subject: 'Account update',
    html: '<p>Your account update is ready.</p>',
  });
} catch (error: unknown) {
  if (error instanceof SendlibValidationError) {
    console.error('Fix the local request:', error.message);
  } else if (error instanceof SendlibAuthenticationError) {
    console.error('Check or rotate the server-side SendLib key.');
  } else if (error instanceof SendlibRateLimitError) {
    console.error('Rate limited for milliseconds:', error.retryAfterMs);
  } else if (error instanceof SendlibApiError) {
    console.error('SendLib returned HTTP', error.status, error.requestId);
    // SendLib has not documented one fixed error-body format, so TypeScript
    // correctly treats `error.body` as unknown. Check its shape and remove
    // sensitive values before using it.
  } else {
    throw error;
  }
}
```

Default error messages never include the API key, request headers, recipient lists, message bodies, or attachment content. Upstream response bodies can themselves contain sensitive information, so do not log `error.body` or failed batch responses without redaction.

## Advanced: timeouts and cancellation

You can skip this section if the default 30-second attempt timeout is suitable.

Override the per-attempt timeout and provide a caller signal to any endpoint method:

```ts
const controller = new AbortController();

const request = sendlib.emails.send(
  {
    to: 'recipient@example.com',
    subject: 'Account update',
    html: '<p>Your account update is ready.</p>',
  },
  {
    signal: controller.signal,
    timeoutMs: 10_000,
  },
);

// Cancelling produces SendlibAbortError, distinct from SendlibTimeoutError.
controller.abort();
await request;
```

For `batches.wait`, `timeoutMs` is the overall polling deadline. Each status request is capped by the smaller of the remaining overall time and the client's per-attempt timeout.

## Retry policy

Automatic retries are deliberately conservative:

| Operation                 | Automatically retried?                                  |
| ------------------------- | ------------------------------------------------------- |
| `POST /api/send`          | Never                                                   |
| `POST /api/batch`         | Never                                                   |
| `GET /api/batch/:batchId` | Network failures, `429`, `500`, `502`, `503`, and `504` |

`maxRetries` counts retries after the first GET attempt. When SendLib says how long to wait after a `429`, the SDK follows that value. Other eligible GET failures use gradually increasing randomized delays. Retry waits still stop for caller cancellation and batch deadlines.

## Deliverability guidance

SendLib recommends transactional, expected, human-looking communication rather than image-heavy marketing blasts. Prefer light HTML or plain text, minimize links, avoid highly urgent/commercial wording, and email only recipients who expect the message.

Analyze a request locally before choosing whether to send it:

```ts
const input = {
  from: '"Alex at Example" <alex@example.com>',
  to: 'recipient@example.com',
  subject: 'Quick update regarding your connection',
  html: '<p>You can restore your connection from your dashboard.</p>',
  text: 'You can restore your connection from your dashboard.',
} as const;

const report = sendlib.deliverability.analyze(input);

for (const issue of report.issues) {
  console.warn(issue.code, issue.message);
}
for (const check of report.manualChecks) {
  console.info(check.code, check.message);
}

// Analysis is advisory and never modifies, logs, blocks, or sends the input.
if (report.passedAutomatedChecks) {
  await sendlib.emails.send(input);
}
```

The analyzer checks explainable local heuristics: multiple links, multiple or embedded images, button-like HTML, missing plain-text fallback, missing sender display-name format, and documented urgent/commercial phrases. It cannot determine consent, inspect remote image size, see the final rendered dashboard template, or guarantee inbox placement. SendLib's returned `debug.issues` remains separate from local SDK advice.

Good fits include password resets, magic links, receipts, invoices, system alerts, welcome messages, user-requested updates, and personalized communication. Weekly marketing newsletters, image-heavy promotions, product catalogs, and mass discount campaigns are poor fits for the service guidance published by SendLib.

## Documented limits

These values come from SendLib's current public documentation and can change independently of this SDK.

| Limit                      |     Free |                     Pro |
| -------------------------- | -------: | ----------------------: |
| API requests per minute    |       30 |                     300 |
| Monthly sends              |    3,500 | Documented as unlimited |
| Personal Gmail daily sends |      200 |                     500 |
| Workspace daily sends      |    1,000 |                   2,000 |
| HTML body                  |     2 MB |                    5 MB |
| Text body                  |     1 MB |                    2 MB |
| Attachments                | 5 × 1 MB |              20 × 10 MB |

Additional documented limits:

- Subject: 998 characters.
- Immediate `to`, `cc`, and `bcc`: 50 addresses per field.
- Batch recipient maximum: 450 for personal Gmail and 2,000 for Workspace.
- Gmail total attachment/message cap: approximately 25 MB.

The SDK enforces universal structural limits where they are safe to know locally. Account-plan limits, Gmail quota state, MIME details, base64 correctness, and actual deliverability remain server-authoritative.

## Security guidance

- Use this SDK only in trusted server-side code.
- Keep API keys in a secret manager or server-only environment variable.
- Never commit `.env`, log request headers, or serialize request bodies into telemetry.
- Never place the key in browser, mobile, desktop, or public-prefixed environment configuration.
- Use fake keys and `example.test` addresses in tests.
- Revoke a key immediately if it is exposed.
- Sanitize upstream error bodies and batch recipient results before logging.
- Keep live sends behind an explicit opt-in and an approved recipient list.

Report SDK vulnerabilities privately according to [SECURITY.md](./SECURITY.md). Do not publish secrets or exploit details in an issue.

## Repository examples

The repository contains commented TypeScript examples:

- [`examples/basic-send.ts`](./examples/basic-send.ts)
- [`examples/template-send.ts`](./examples/template-send.ts)
- [`examples/attachment.ts`](./examples/attachment.ts)
- [`examples/batch-send.ts`](./examples/batch-send.ts)

They compile during `bun run ci` and refuse to run unless `SENDLIB_RUN_EXAMPLE=true`. Copy `.env.example` to `.env`, replace every placeholder with maintainer-approved values, then opt in only when you intend to send real mail:

```sh
SENDLIB_RUN_EXAMPLE=true bun run examples/basic-send.ts
```

On PowerShell:

```powershell
$env:SENDLIB_RUN_EXAMPLE = 'true'
bun run examples/basic-send.ts
```

Batch examples additionally require a Pro SendLib account. Running an example can send real email and consume SendLib or Gmail quota.

## Supported versions and deprecation

Before npm publication, fixes land on the default branch. After `0.1.0`, the latest release receives support. While the package is in the `0.x` series, minor releases may contain breaking changes and will include migration notes. Normal deprecations are announced through types, documentation, and the changelog and remain for at least one minor release when practical. Security changes may use a shorter window. See [SECURITY.md](./SECURITY.md).

When SendLib's upstream contract changes, this project records evidence in `CONTRACT.md`, adds sanitized fixtures and tests, preserves unknown fields where possible, and releases the appropriate Semantic Versioning change. Report suspected drift with the API contract issue template.

## Contributing and support

- Contributors work on a fork or feature branch and open a pull request into `master`; direct `master` pushes are reserved for repository administrators.
- Push follow-up commits to the same pull-request branch after review. You do not need to open a new pull request for each revision.
- Merging a pull request does not automatically publish npm. Maintainers control versioning and releases separately.
- Read [CONTRIBUTING.md](./CONTRIBUTING.md) before opening a pull request.
- Follow [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md).
- Use [GitHub Issues](https://github.com/amnesia2k/sendlib-sdk/issues) for SDK bugs, feature requests, and contract changes.
- Use [SendLib's official documentation and support](https://sendlib.samueltuoyo.com/docs) for service or account problems.

The repository currently has one maintainer, so a CODEOWNERS file is intentionally unnecessary. Ownership can be added if the maintainer team expands.

## Contributors and acknowledgements

Contributors, including contributors affiliated with SendLib, are welcome and will be credited through the repository history and relevant release notes. A contributor is not automatically a project maintainer, an official SendLib representative for this SDK, or a source of SendLib account and service support. Those roles will be stated explicitly if they are formally agreed.

## Community status and trademarks

“SendLib” is used only to identify the service this SDK interoperates with. SendLib and related names, marks, and assets belong to their respective owners. This project uses no SendLib logo or copied visual identity. Contributions from people affiliated with SendLib do not change the project's independent status unless an official relationship is explicitly announced in writing.

## License

This community SDK is available under the [MIT License](./LICENSE).
