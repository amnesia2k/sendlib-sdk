# SendLib Node SDK: complete TypeScript examples

This guide covers every public operation exported by `@sendlib/node-sdk` version `0.1.2`. Use the SDK only in trusted server-side Node.js code; never expose a SendLib API key in a browser bundle.

## Install and configure

The SDK requires Node.js 22 or newer.

```sh
npm install @sendlib/node-sdk
```

Set the key in your server environment:

```dotenv
SENDLIB_API_KEY=sl_your_api_key_here
```

Create one client and reuse it:

```ts
import { Sendlib, VERSION } from "@sendlib/node-sdk";

const apiKey = process.env.SENDLIB_API_KEY;
if (!apiKey) {
  throw new Error("SENDLIB_API_KEY is required");
}

export const sendlib = new Sendlib({ apiKey });

console.log(`Using @sendlib/node-sdk ${VERSION}`);
```

`VERSION` is a string constant, not a function. The `Sendlib` constructor validates and snapshots its options.

### All constructor options

```ts
import { Sendlib, type SendlibFetch } from "@sendlib/node-sdk";

const apiKey = process.env.SENDLIB_API_KEY;
if (!apiKey) throw new Error("SENDLIB_API_KEY is required");

const tracedFetch: SendlibFetch = async (input, init) => {
  const startedAt = performance.now();

  try {
    return await fetch(input, init);
  } finally {
    // Do not log authorization headers, recipients, or message bodies.
    console.info("SendLib HTTP duration (ms):", performance.now() - startedAt);
  }
};

const configuredSendlib = new Sendlib({
  apiKey,
  baseUrl: "https://sendlib.samueltuoyo.com",
  authMode: "bearer", // Or 'x-api-key'. The default is 'bearer'.
  timeoutMs: 30_000,
  maxRetries: 2, // Applies only to operations that are safe to retry.
  fetch: tracedFetch,
});

void configuredSendlib;
```

The SDK never loads `.env` itself. `baseUrl` is mainly useful for a compatible proxy or test server.

## 1. `sendlib.emails.send()`

`emails.send()` supports either custom content or an existing dashboard template. These modes cannot be mixed.

### Send custom HTML and plain text

```ts
const response = await sendlib.emails.send({
  from: '"Example Support" <support@example.com>',
  to: ["ada@example.com", "grace@example.com"],
  cc: "account-owner@example.com",
  bcc: ["audit@example.com", "records@example.com"],
  replyTo: "helpdesk@example.com",
  subject: "Your account update",
  html: "<p>Your requested account update is ready.</p>",
  text: "Your requested account update is ready.",
});

console.log("Debug issue count:", response.debug?.issues?.length ?? 0);
```

Custom sends require `subject` and `html`; `text` is an optional fallback. SendLib accepts either one address or an array in `to`, `cc`, and `bcc`.

### Send an attachment

```ts
import { readFile } from "node:fs/promises";

const pdf = await readFile("./invoice.pdf");

await sendlib.emails.send({
  to: "customer@example.com",
  subject: "Your invoice",
  html: "<p>Your invoice is attached.</p>",
  text: "Your invoice is attached.",
  attachments: [
    {
      filename: "invoice.pdf",
      content: pdf.toString("base64"),
      type: "application/pdf",
    },
  ],
});
```

Pass raw base64 in `content`, without a `data:` URL prefix. Batch sends do not support attachments.

### Send a dashboard template through the lower-level method

```ts
await sendlib.emails.send({
  from: '"Example App" <app@example.com>',
  to: "ada@example.com",
  template: "password-reset",
  data: {
    name: "Ada",
    code: "482921",
  },
});
```

Use one recipient string in template mode. Template variables must match the editable template in your SendLib dashboard.

### Per-call timeout and cancellation

Every HTTP endpoint method accepts `SendlibCallOptions` as its final argument:

```ts
import { SendlibAbortError, SendlibTimeoutError } from "@sendlib/node-sdk";

const controller = new AbortController();

try {
  const request = sendlib.emails.send(
    {
      to: "ada@example.com",
      subject: "Your account update",
      html: "<p>Your account update is ready.</p>",
    },
    {
      signal: controller.signal,
      timeoutMs: 10_000,
    },
  );

  // Call controller.abort() elsewhere if the surrounding job is cancelled.
  await request;
} catch (error: unknown) {
  if (error instanceof SendlibAbortError) {
    console.error("The caller cancelled the send.");
  } else if (error instanceof SendlibTimeoutError) {
    console.error("The HTTP attempt timed out.");
  } else {
    throw error;
  }
}
```

The SDK never automatically retries an email-creating POST.

## 2. Template operations

Templates must already exist in the SendLib dashboard. The generic method supports any current or future slug, while the nine convenience methods select documented starter slugs.

### `sendlib.templates.send()`

```ts
await sendlib.templates.send(
  "my-dashboard-template",
  {
    from: '"Example App" <app@example.com>',
    to: "ada@example.com",
    data: {
      name: "Ada",
      preferences: { locale: "en-NG" },
    },
  },
  { timeoutMs: 10_000 },
);
```

### `sendlib.templates.welcome()`

```ts
await sendlib.templates.welcome({
  to: "ada@example.com",
  data: { name: "Ada", product: "Example Cloud" },
});
```

Slug: `welcome`.

### `sendlib.templates.verifyEmail()`

```ts
await sendlib.templates.verifyEmail({
  to: "ada@example.com",
  data: {
    name: "Ada",
    link: "https://example.com/verify?token=server-generated-token",
  },
});
```

Slug: `verify-email`.

### `sendlib.templates.passwordReset()`

```ts
await sendlib.templates.passwordReset({
  to: "ada@example.com",
  data: { name: "Ada", code: "482921" },
});
```

Slug: `password-reset`.

### `sendlib.templates.otp()`

```ts
await sendlib.templates.otp({
  to: "ada@example.com",
  data: { name: "Ada", code: "731904" },
});
```

Slug: `otp`.

### `sendlib.templates.invoice()`

```ts
await sendlib.templates.invoice({
  to: "ada@example.com",
  data: {
    name: "Ada",
    amount: "NGN 12,500.00",
    invoice_id: "INV-2026-0042",
    date: "2026-09-15",
  },
});
```

Slug: `invoice`.

### `sendlib.templates.paymentSuccessful()`

```ts
await sendlib.templates.paymentSuccessful({
  to: "ada@example.com",
  data: {
    name: "Ada",
    amount: "NGN 12,500.00",
    product: "Example Cloud Pro",
  },
});
```

Slug: `payment-successful`.

### `sendlib.templates.paymentFailed()`

```ts
await sendlib.templates.paymentFailed({
  to: "ada@example.com",
  data: {
    name: "Ada",
    amount: "NGN 12,500.00",
    retry_url: "https://example.com/billing/retry",
  },
});
```

Slug: `payment-failed`.

### `sendlib.templates.subscriptionExpiring()`

```ts
await sendlib.templates.subscriptionExpiring({
  to: "ada@example.com",
  data: {
    name: "Ada",
    plan: "Pro",
    date: "2026-09-30",
  },
});
```

Slug: `subscription-expiring`.

### `sendlib.templates.accountSuspended()`

```ts
await sendlib.templates.accountSuspended({
  to: "ada@example.com",
  data: {
    name: "Ada",
    reason: "Billing verification is required",
    support_url: "https://example.com/support",
  },
});
```

Slug: `account-suspended`.

All template methods also accept optional `from`, and all accept `{ signal, timeoutMs }` as a second argument. The sample variable names above are hints, not enforced fields: dashboard templates are editable and `data` accepts `Readonly<Record<string, unknown>>`.

## 3. Deliverability analysis

Analysis is synchronous and local. It does not make an HTTP request, mutate the input, block sending, or guarantee inbox placement.

### `sendlib.deliverability.analyze()`

```ts
import type { SendEmailInput } from "@sendlib/node-sdk";

const email: SendEmailInput = {
  from: '"Example Support" <support@example.com>',
  to: "ada@example.com",
  subject: "A quick update about your account",
  html: "<p>Your requested account update is ready.</p>",
  text: "Your requested account update is ready.",
};

const report = sendlib.deliverability.analyze(email);

for (const issue of report.issues) {
  console.warn(issue.code, issue.field, issue.message);
}

for (const check of report.manualChecks) {
  console.info(check.code, check.message);
}

if (report.passedAutomatedChecks) {
  await sendlib.emails.send(email);
}
```

### `analyzeDeliverability()`

The package also exports the same analyzer as a standalone function, so no client or API key is required:

```ts
import {
  analyzeDeliverability,
  type CreateBatchInput,
} from "@sendlib/node-sdk";

const batchDraft: CreateBatchInput = {
  from: '"Example Operations" <operations@example.com>',
  subject: "Service update for {{name}}",
  recipients: [{ email: "ada@example.com", variables: { name: "Ada" } }],
  html: "<p>Hello {{name}}, your service update is ready.</p>",
  text: "Hello {{name}}, your service update is ready.",
};

const batchReport = analyzeDeliverability(batchDraft);
console.log(batchReport.passedAutomatedChecks, batchReport.issues);
```

Template bodies are not visible to the analyzer, so template content appears as a manual check.

## 4. Pro batch operations

Batch sending requires a SendLib Pro plan. A batch is queued once, then retrieved or polled by ID.

### `sendlib.batches.create()`

```ts
const created = await sendlib.batches.create(
  {
    from: '"Example Operations" <operations@example.com>',
    subject: "Service update for {{name}}",
    recipients: [
      { email: "ada@example.com", variables: { name: "Ada" } },
      { email: "grace@example.com", variables: { name: "Grace" } },
    ],
    html: "<p>Hello {{name}}, your service update is ready.</p>",
    text: "Hello {{name}}, your service update is ready.",
    replyTo: "support@example.com",
  },
  { timeoutMs: 30_000 },
);

console.log(created.batchId, created.total, created.status);
```

At least one of `html` or `text` is required. The creation POST is never automatically retried because a failed connection can leave the creation result ambiguous.

### `sendlib.batches.retrieve()`

Retrieve one status snapshot when your application controls its own scheduling:

```ts
const status = await sendlib.batches.retrieve(created.batchId, {
  timeoutMs: 10_000,
});

console.log({
  status: status.status,
  progress: status.progress,
  sent: status.sent,
  failed: status.failed,
  total: status.total,
});

for (const recipient of status.recipients) {
  console.log(recipient.email, recipient.status, recipient.messageId);
}
```

This safe GET can be retried according to the client's `maxRetries` setting.

### `sendlib.batches.wait()`

Poll until the batch finishes, fails, pauses at a Gmail limit, is cancelled, or reaches its overall deadline:

```ts
const finalStatus = await sendlib.batches.wait(created.batchId, {
  intervalMs: 1_000,
  timeoutMs: 60_000,
  returnOnPausedLimit: true,
});

if (finalStatus.status === "paused_limit_reached") {
  console.info(
    "Gmail quota paused the batch; persist its ID and check again later.",
  );
} else {
  console.info("Batch completed:", finalStatus.sent, finalStatus.failed);
}
```

For `wait()`, `timeoutMs` is the deadline for the entire polling operation, not just one HTTP attempt. A `failed` status throws `SendlibBatchFailedError`. Setting `returnOnPausedLimit: false` keeps polling a paused batch until its state changes, it is cancelled, or the deadline expires.

### Cancel batch polling

```ts
import { SendlibAbortError } from "@sendlib/node-sdk";

const pollingController = new AbortController();

try {
  const polling = sendlib.batches.wait(created.batchId, {
    intervalMs: 1_000,
    timeoutMs: 60_000,
    signal: pollingController.signal,
  });

  // Call pollingController.abort() from shutdown or job-cancellation logic.
  await polling;
} catch (error: unknown) {
  if (error instanceof SendlibAbortError) {
    console.info(
      "Batch polling was cancelled; the remote batch was not cancelled.",
    );
  } else {
    throw error;
  }
}
```

Cancelling `wait()` stops local polling only; it does not cancel the batch on SendLib.

## 5. Handle every public SDK error

Applications normally catch errors produced by SDK calls rather than constructing error objects themselves. All public SDK errors extend `SendlibError`.

```ts
import {
  SendlibAbortError,
  SendlibApiError,
  SendlibAuthenticationError,
  SendlibBatchFailedError,
  SendlibBatchWaitTimeoutError,
  SendlibConfigError,
  SendlibError,
  SendlibForbiddenError,
  SendlibNetworkError,
  SendlibPayloadTooLargeError,
  SendlibPlanRequiredError,
  SendlibRateLimitError,
  SendlibTimeoutError,
  SendlibValidationError,
} from "@sendlib/node-sdk";

function describeSendlibError(error: unknown): string {
  // Check subclasses before their parent classes.
  if (error instanceof SendlibPlanRequiredError) {
    return `The ${error.feature} feature requires the ${error.requiredPlan} plan.`;
  }
  if (error instanceof SendlibAuthenticationError) {
    return "Check or rotate the server-side API key.";
  }
  if (error instanceof SendlibPayloadTooLargeError) {
    return "Reduce the message or attachment size.";
  }
  if (error instanceof SendlibRateLimitError) {
    return `Rate limited; retry after ${error.retryAfterMs ?? "an unknown number of"} ms.`;
  }
  if (error instanceof SendlibForbiddenError) {
    return "The authenticated account is not allowed to perform this operation.";
  }
  if (error instanceof SendlibBatchFailedError) {
    return `Batch ${error.batchId} reached the failed state.`;
  }
  if (error instanceof SendlibBatchWaitTimeoutError) {
    return `Batch ${error.batchId} did not finish within ${error.timeoutMs} ms.`;
  }
  if (error instanceof SendlibConfigError) {
    return `Invalid client configuration: ${error.message}`;
  }
  if (error instanceof SendlibValidationError) {
    return `Invalid call input: ${error.message}`;
  }
  if (error instanceof SendlibTimeoutError) {
    return "One SendLib HTTP attempt timed out.";
  }
  if (error instanceof SendlibAbortError) {
    return "The caller cancelled the operation.";
  }
  if (error instanceof SendlibNetworkError) {
    return "No HTTP response was received from SendLib.";
  }
  if (error instanceof SendlibApiError) {
    return `SendLib returned HTTP ${error.status}; request ID: ${error.requestId ?? "unknown"}.`;
  }
  if (error instanceof SendlibError) {
    return error.message;
  }
  return "An unexpected non-SendLib error occurred.";
}

try {
  await sendlib.emails.send({
    to: "ada@example.com",
    subject: "Your account update",
    html: "<p>Your account update is ready.</p>",
  });
} catch (error: unknown) {
  console.error(describeSendlibError(error));
}
```

`SendlibApiError.body`, `SendlibBatchFailedError.response`, and recipient data may contain sensitive or undocumented values. Narrow and redact them before logging.

## Complete callable API checklist

| Public call                                               | Purpose                                                  |
| --------------------------------------------------------- | -------------------------------------------------------- |
| `new Sendlib(options)`                                    | Create and configure a reusable SDK client.              |
| `sendlib.emails.send(input, options?)`                    | Send custom content or a dashboard template immediately. |
| `sendlib.templates.send(slug, input, options?)`           | Send any dashboard template slug.                        |
| `sendlib.templates.welcome(input, options?)`              | Send the `welcome` starter template.                     |
| `sendlib.templates.verifyEmail(input, options?)`          | Send the `verify-email` starter template.                |
| `sendlib.templates.passwordReset(input, options?)`        | Send the `password-reset` starter template.              |
| `sendlib.templates.otp(input, options?)`                  | Send the `otp` starter template.                         |
| `sendlib.templates.invoice(input, options?)`              | Send the `invoice` starter template.                     |
| `sendlib.templates.paymentSuccessful(input, options?)`    | Send the `payment-successful` starter template.          |
| `sendlib.templates.paymentFailed(input, options?)`        | Send the `payment-failed` starter template.              |
| `sendlib.templates.subscriptionExpiring(input, options?)` | Send the `subscription-expiring` starter template.       |
| `sendlib.templates.accountSuspended(input, options?)`     | Send the `account-suspended` starter template.           |
| `sendlib.deliverability.analyze(input)`                   | Analyze an input locally through a client namespace.     |
| `analyzeDeliverability(input)`                            | Analyze an input locally without creating a client.      |
| `sendlib.batches.create(input, options?)`                 | Queue a Pro batch.                                       |
| `sendlib.batches.retrieve(batchId, options?)`             | Retrieve one batch status snapshot.                      |
| `sendlib.batches.wait(batchId, options?)`                 | Poll a batch with a bounded deadline.                    |

That checklist contains every callable entry point exported from the package root. The remaining public exports are TypeScript types, error classes intended for `instanceof` checks, and the `VERSION` constant.
