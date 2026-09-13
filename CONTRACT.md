# SendLib public API contract audit

Audit date: 2026-09-12

This document records what the public SendLib documentation actually guarantees for the community SDK. It separates documented behavior from implementation policy so that undocumented assumptions do not accidentally become promises in `@sendlib/node-sdk`.

The v1 sending surface is anchored specifically to the current Basic Send, Templates, and Batch Send pages. Other pages provide authentication, quota, and debugger context, but they do not expand the endpoint surface implemented by this SDK.

## Sources audited

- <https://sendlib.samueltuoyo.com/docs>
- <https://sendlib.samueltuoyo.com/docs/quickstart>
- <https://sendlib.samueltuoyo.com/docs/limits>
- <https://sendlib.samueltuoyo.com/docs/gmail>
- <https://sendlib.samueltuoyo.com/docs/keys>
- <https://sendlib.samueltuoyo.com/docs/send>
- <https://sendlib.samueltuoyo.com/docs/templates>
- <https://sendlib.samueltuoyo.com/docs/debugger>
- <https://sendlib.samueltuoyo.com/docs/batch>
- <https://sendlib.samueltuoyo.com/sitemap.xml>

The sitemap lists the pages above and no machine-readable API reference. The following conventional public specification locations returned `404` during the audit:

- `/openapi.json`
- `/api/openapi.json`
- `/swagger.json`
- `/api/swagger.json`
- `/docs/openapi.json`
- `/api-docs`
- `/swagger`

Internet search also found no public SendLib OpenAPI or Swagger document. This establishes only that no public specification was discoverable; SendLib could still have a private/internal specification.

## Contract-confidence labels

- **Documented**: explicitly stated or shown by the current public documentation.
- **Demonstrated**: present in an official example, but not described as an exhaustive schema.
- **Not documented**: the public pages do not define it. SDK code must remain defensive.
- **SDK policy**: our compatibility choice, not a claim about undocumented upstream behavior.

## Base URL, routes, and authentication

| Item                     | Finding                                  | Confidence                          | SDK policy                                                                                                    |
| ------------------------ | ---------------------------------------- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Production base URL      | `https://sendlib.samueltuoyo.com`        | Documented and maintainer-confirmed | Default `baseUrl`; allow override for tests/proxies.                                                          |
| Immediate/template send  | `POST /api/send`                         | Documented                          | One transport method with discriminated custom/template inputs.                                               |
| Batch creation           | `POST /api/batch`                        | Documented                          | Pro-only client method.                                                                                       |
| Batch retrieval          | `GET /api/batch/:batchId`                | Documented                          | Encode the ID as one path segment.                                                                            |
| Bearer authentication    | `Authorization: Bearer YOUR_API_KEY`     | Documented and maintainer-confirmed | Default authentication mode.                                                                                  |
| Alternate authentication | `x-api-key: YOUR_API_KEY`                | Documented and maintainer-approved  | Public opt-in authentication mode.                                                                            |
| API version              | Routes currently have no version segment | Demonstrated                        | Do not invent `/v1`; isolate paths internally for later migration.                                            |
| Versioning policy        | None published                           | Not documented                      | Treat upstream drift as a contract event and cover it with fixtures.                                          |
| Idempotency key          | None mentioned                           | Not documented                      | Never automatically retry ambiguous POST failures.                                                            |
| Request/correlation ID   | No response field/header documented      | Not documented                      | Preserve safe headers internally when available, but expose no guaranteed request-ID property until verified. |

## `POST /api/send` — custom content

### Documented request

| Field         | Documented type         | Required by docs               | Notes                                                                                                                                                                                                                       |
| ------------- | ----------------------- | ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `from`        | `string`                | Contradictory                  | The field table calls it required, while the introductory paragraph says it may be omitted and the first connected Gmail account is then used. Template docs say it is optional with one account and required with several. |
| `to`          | `string` or `string[]`  | Yes                            | Up to 50 addresses.                                                                                                                                                                                                         |
| `subject`     | `string`                | Yes                            | Maximum 998 characters.                                                                                                                                                                                                     |
| `html`        | `string`                | Yes for documented custom mode | The basic-send table presents HTML as the body and calls `text` an optional fallback. The templates page says custom mode uses `subject` + `html`. The docs do not explicitly promise text-only custom sends.               |
| `text`        | `string`                | No                             | Described as a plain-text fallback.                                                                                                                                                                                         |
| `replyTo`     | `string`                | No                             | Reply-To email address.                                                                                                                                                                                                     |
| `cc`          | `string` or `string[]`  | No                             | Up to 50 addresses.                                                                                                                                                                                                         |
| `bcc`         | `string` or `string[]`  | No                             | Up to 50 addresses.                                                                                                                                                                                                         |
| `attachments` | attachment object array | No                             | See attachment section.                                                                                                                                                                                                     |

### SDK decisions for ambiguous custom fields

- Make `from` optional in the request type because the docs explicitly describe defaulting to the first connected Gmail account. Explain that applications with multiple connected accounts must provide it. Do not reject omission locally.
- Require `subject` and `html` for the documented v1 custom-content type.
- Keep `text` optional as the fallback body.
- Do not advertise text-only sending until SendLib documents or verifies it.
- Preserve caller strings without rewriting HTML, subject lines, addresses, or display-name format.

### Custom-send success response

The public quick-start and basic-send pages show requests but provide no success status code or response JSON example. The debugger page only states that `/api/send` responses include `debug.issues`, and that Gmail eventually returns a message ID.

SDK policy for v1:

- Do not claim a complete strongly required `SendEmailResponse` schema.
- Parse the successful response as JSON defensively.
- Model only explicitly documented optional information, such as optional `debug`, while retaining unknown fields.
- Keep undocumented response properties typed as `unknown` for the lifetime of the v1 API. If reliable upstream evidence appears later, add optional narrowed helpers or fields without making existing unknown data inaccessible.
- A missing upstream fixture is not a release blocker because the SDK does not depend on an invented response shape.

## `POST /api/send` — dashboard template

### Documented request

```json
{
  "template": "password-reset",
  "to": "user@gmail.com",
  "data": {
    "name": "John",
    "code": "482921"
  }
}
```

- `template` is a dashboard template slug.
- `to` is shown as a string; the page does not explicitly state whether template sends accept a recipient array, CC, BCC, Reply-To, or attachments.
- `data` is called an object that supplies `{{variable}}` placeholders.
- The examples demonstrate string values only. No exhaustive value-type contract is published.
- `from` is optional with one connected Gmail account and required with multiple accounts.
- Missing data returns `400` and lists empty placeholders.
- Custom content is described as the alternative where `template` is omitted and `subject` + `html` are sent.

### SDK decisions for templates

- Model template mode separately from custom mode.
- Require `template`, `to`, and `data`; allow optional `from`.
- Treat custom `subject`, `html`, and `text` as mutually exclusive with `template` unless SendLib confirms overrides.
- Use `Record<string, unknown>` for `data` and serialize values unchanged because the docs do not define an exhaustive value type. Do not locally promise that every JSON value will interpolate successfully.
- Do not add custom-mode fields to the template input unless the docs or a verified test confirm them.
- Provide a `sendlib.templates` namespace as an SDK convenience; it still calls the documented `POST /api/send` endpoint and does not imply a template-management API.
- Provide `sendlib.templates.send(slug, input)` for any dashboard template slug.
- Provide camel-cased convenience methods for the nine documented starter slugs. Each method maps to the exact upstream slug and accepts the same `to`, optional `from`, and `data` shape as generic template send.
- Keep starter-template `data` values as `Record<string, unknown>`. Dashboard templates are editable, so hard-coding required variable keys would become incorrect when a user changes a template. Documented variables are editor hints and examples, while SendLib's `400` response remains authoritative for missing values.

### Documented starter template mapping

| SDK method                                    | Upstream slug           | Variables shown in docs                |
| --------------------------------------------- | ----------------------- | -------------------------------------- |
| `sendlib.templates.welcome(...)`              | `welcome`               | `name`, `product`                      |
| `sendlib.templates.verifyEmail(...)`          | `verify-email`          | `name`, `link`                         |
| `sendlib.templates.passwordReset(...)`        | `password-reset`        | `name`, `code`                         |
| `sendlib.templates.otp(...)`                  | `otp`                   | `name`, `code`                         |
| `sendlib.templates.invoice(...)`              | `invoice`               | `name`, `amount`, `invoice_id`, `date` |
| `sendlib.templates.paymentSuccessful(...)`    | `payment-successful`    | `name`, `amount`, `product`            |
| `sendlib.templates.paymentFailed(...)`        | `payment-failed`        | `name`, `amount`, `retry_url`          |
| `sendlib.templates.subscriptionExpiring(...)` | `subscription-expiring` | `name`, `plan`, `date`                 |
| `sendlib.templates.accountSuspended(...)`     | `account-suspended`     | `name`, `reason`, `support_url`        |

The generic method is the forward-compatible escape hatch for user-created slugs and any starter slugs SendLib adds later. The SDK will not fetch, list, create, update, render, or delete dashboard templates because no public management endpoint is documented.

### Template-send success response

No separate success response is documented. Template sends use the same `/api/send` endpoint and therefore use the defensive `SendEmailResponse` policy: preserve returned fields, type undocumented values as `unknown`, and do not block v1 on a fixture.

## Deliverability guidance

The Basic Send and Batch Send pages publish the same recommendations for personal Gmail accounts: prefer plain text or light HTML, minimize links, avoid highly urgent/commercial wording, and only email recipients who expect the message. They also recommend recognizable display-name senders and show heavy calls to action as a high-risk pattern. These are recommendations, not API validity rules, and neither SendLib nor this SDK can guarantee inbox placement.

SDK policy:

- Export `analyzeDeliverability(input)` and later expose the same function through `sendlib.deliverability.analyze(input)`.
- Return immutable structured warnings; never rewrite caller content, block a send, or log automatically.
- Detect only explainable local heuristics: documented trigger phrases, more than one link, multiple or embedded images, button-like HTML, missing plain-text fallback, and a plain sender address without display-name form.
- Return manual-check reminders for facts code cannot establish, especially whether every recipient expects the message, actual image/layout weight, and the final rendered content of dashboard templates.
- Never include the subject, body, sender, recipients, matched phrases, URLs, or attachment data in a report. Reports contain stable issue codes and generic safe messages only.
- Treat a clean report as “no configured heuristic warning found,” never as a deliverability score, consent determination, or spam-filter guarantee.
- Keep SendLib's upstream `debug.issues` separate and preserved; local issues are SDK advice and must not be presented as SendLib server findings.

## Attachments

Documented attachment object:

```json
{
  "filename": "invoice.pdf",
  "content": "JVBERi0xLjQKJ...",
  "type": "application/pdf"
}
```

| Field      | Type     | Required | Meaning                      |
| ---------- | -------- | -------- | ---------------------------- |
| `filename` | `string` | Yes      | Attachment filename.         |
| `content`  | `string` | Yes      | Base64-encoded file content. |
| `type`     | `string` | No       | MIME content type.           |

Limits currently documented:

- Free: up to 5 files and 1 MB per file.
- Pro: up to 20 files and 10 MB per file.
- Gmail enforces a 25 MB total cap.
- Batch sends do not support attachments.

The docs do not specify accepted base64 alphabets, padding rules, data-URL handling, MIME inference, or how size is calculated. The SDK will accept a base64 string and optional MIME string without re-encoding it; upstream validation remains authoritative.

## `debug.issues`

The debugger page explicitly says `/api/send` responses contain `debug.issues`. It lists these issue categories in human-readable form:

- Missing `{{variable}}`
- Bad email address
- Invalid HTML
- Image has no `alt`
- No unsubscribe URL
- Broken link
- HTML too large

The page does not publish JSON showing whether an issue is a string or object, nor field names for issue code, severity, message, path, or metadata. It also does not promise that the list is exhaustive or version-stable.

SDK policy:

- Treat `debug` and `issues` as optional.
- Initially preserve issue entries as `unknown[]` (and unknown debug fields) rather than inventing a schema.
- Add narrowed issue types only after sanitized responses demonstrate the structure.
- Never discard debug data returned by SendLib.

## `POST /api/batch`

Batch sending is documented as Pro-only and returns HTTP `202 Accepted`.

### Documented request fields

| Field        | Type                   | Required         | Notes                                                                                      |
| ------------ | ---------------------- | ---------------- | ------------------------------------------------------------------------------------------ |
| `from`       | `string`               | Yes              | Connected Gmail account; display-name format supported.                                    |
| `subject`    | `string`               | Yes              | Supports `{{variable}}` interpolation.                                                     |
| `recipients` | recipient object array | Yes              | Max 450 personal Gmail; max 2,000 Workspace. Duplicate emails are deduplicated by SendLib. |
| `html`       | `string`               | One of HTML/text | Supports interpolation.                                                                    |
| `text`       | `string`               | One of HTML/text | Supports interpolation.                                                                    |
| `replyTo`    | `string`               | No               | Reply-To address.                                                                          |

Recipient objects contain required string `email` and optional `variables`, described as key/value pairs. As with template `data`, examples use string values and no exhaustive value-type contract is published. The SDK will use `Record<string, unknown>` and serialize values unchanged.

### Documented `202` response

```json
{
  "success": true,
  "batchId": "64f1a2b3c4d5e6f7a8b9c0d1",
  "total": 2,
  "status": "queued"
}
```

This example is captured in `test/fixtures/contracts/batch-create.success.json`.

### Pro-plan access and documented `403`

The batch page prominently requires a Pro subscription and documents `403` as “Free plan: upgrade to Pro to use batch sending.” It does not publish the `403` response body. No public account/plan endpoint is documented, so the SDK must not guess the caller's plan or make a preflight request.

SDK policy:

- Clearly mark `sendlib.batches.create`, `retrieve`, and `wait` as Pro-only in types, JSDoc, README examples, and generated documentation.
- Send the requested batch call normally. For a `403` returned by a batch endpoint, throw `SendlibPlanRequiredError`, a subtype of `SendlibForbiddenError`.
- Give that SDK error stable local properties: HTTP `status` 403, `feature` set to `batch`, and `requiredPlan` set to `pro`.
- Use a safe SDK-authored message such as “Batch sending requires a SendLib Pro plan.” Preserve the unverified upstream body separately as `unknown`; never rely on it containing a particular message or code.
- Do not retry the rejected request and do not suggest that the SDK can upgrade, inspect, or bypass the user's SendLib plan.
- Keep non-batch `403` responses mapped to the general `SendlibForbiddenError`.

## `GET /api/batch/:batchId`

### Documented response example

```json
{
  "success": true,
  "batchId": "64f1a2b3c4d5e6f7a8b9c0d1",
  "status": "processing",
  "total": 2,
  "sent": 1,
  "failed": 0,
  "progress": 50,
  "recipients": [
    {
      "email": "john@example.com",
      "status": "sent",
      "messageId": "18b3f...",
      "error": null
    },
    {
      "email": "jane@example.com",
      "status": "pending",
      "messageId": null,
      "error": null
    }
  ]
}
```

This example is captured in `test/fixtures/contracts/batch-status.processing.json`.

The example demonstrates recipient statuses `sent` and `pending`. It does not publish an exhaustive recipient-status list. Although the aggregate response has a `failed` count, this alone is not enough to assert the exact recipient failure-status string or error shape.

SDK policy:

- Provide known autocomplete values for `sent` and `pending` while allowing an unknown string for forward compatibility.
- Keep `messageId` and `error` nullable as demonstrated.
- Do not define the internal shape of a non-null recipient `error` until verified.

## Batch job statuses

The docs explicitly define all of these top-level values:

| Status                 | Meaning                                                                     |
| ---------------------- | --------------------------------------------------------------------------- |
| `queued`               | Created and waiting for a worker.                                           |
| `processing`           | Worker is actively sending.                                                 |
| `paused_limit_reached` | Gmail daily limit reached; SendLib automatically resumes when quota resets. |
| `done`                 | Every recipient has been processed; inspect sent/failed counts.             |
| `failed`               | Unexpected internal job error.                                              |

The SDK may use this documented closed union but should still parse unknown future statuses defensively at the transport boundary.

### SDK wait behavior

`sendlib.batches.wait(batchId, options?)` polls only `GET /api/batch/:batchId`; it never repeats the batch-creation POST. The batch ID is validated and URL-encoded before use.

- `queued` and `processing` continue polling.
- `done` returns the complete status response.
- `failed` throws `SendlibBatchFailedError`. Its response diagnostics are non-enumerable because they can contain recipient addresses and delivery errors.
- `paused_limit_reached` returns by default, allowing the application to persist state and resume later when Gmail quota resets. `returnOnPausedLimit: false` continues polling within the same finite deadline.
- A caller abort throws `SendlibAbortError`; expiry of the overall polling deadline throws `SendlibBatchWaitTimeoutError`.

The default interval is 1 second and must remain positive. The default overall timeout is 60 seconds and every caller-supplied timeout must be finite and nonnegative. The overall deadline aborts active retrieval attempts, safe-GET retry waits, and polling delays, preventing retries from making the helper unbounded. Unknown future aggregate status strings are preserved at the JSON boundary and treated as nonterminal during a bounded wait.

## Errors and rate limits

Documented status behavior:

| Status | Published meaning                                                                                              |
| ------ | -------------------------------------------------------------------------------------------------------------- |
| `400`  | Validation error; batch docs say to check the `message` field. Template docs say missing variables are listed. |
| `401`  | Missing or invalid API key.                                                                                    |
| `403`  | Batch sending attempted from Free plan; upgrade to Pro.                                                        |
| `413`  | HTML or text body exceeds the size limit.                                                                      |
| `429`  | Rate limit exceeded; inspect `Retry-After`.                                                                    |
| `500`  | Internal server error.                                                                                         |

The public docs provide no complete JSON example for any error and do not state that this list is exhaustive for `/api/send`. Only the existence of a `message` field for batch validation errors is mentioned. They do not define error code, details, field errors, timestamp, path, request ID, or whether the body is always JSON.

SDK policy:

- Parse error bodies defensively as unknown JSON or text.
- Extract `message` only when it is a string.
- Preserve the HTTP status and `Retry-After`.
- Use stable SDK-authored error messages and preserve the entire upstream body as non-enumerable `unknown` data.
- Treat optional string `message`, string `code`, and `x-request-id` values as observations rather than guaranteed schema fields.
- Map caller cancellation, per-attempt timeout, and network failure to distinct public SDK error classes.
- Do not publish required error-body fields other than the HTTP status supplied by the transport.
- Map `403` from a batch endpoint to the stable SDK-authored `SendlibPlanRequiredError`; preserve its unverified upstream body as `unknown`.
- Never leak authentication headers or request content in constructed errors.
- Treat sanitized upstream error fixtures as optional future evidence, not a prerequisite for safe error handling. Transport tests will use synthetic unknown JSON, text, malformed, and empty bodies.

### SDK retry and redaction contract

- Automatic retries are restricted to GET requests. Network failures, `429`, and `500`, `502`, `503`, or `504` are retryable up to the configured `maxRetries` limit.
- POST requests are never automatically retried because SendLib does not document idempotency support.
- `Retry-After` accepts documented delta seconds and standard IMF-fixdate values. It takes precedence over exponential full-jitter backoff for `429` responses.
- Retry waits remain caller-cancellable and do not extend the per-attempt timeout into an overall operation timeout.
- Public errors never retain request headers, credentials, request bodies, attachment content, or recipient lists.
- Network causes are sanitized at the transport boundary because an injected Fetch implementation can throw arbitrary secret-bearing messages.
- Parsed upstream response bodies remain deliberately available as non-enumerable `unknown` diagnostics; callers must treat upstream bodies as potentially sensitive and avoid logging them blindly.

## Rate and payload limits

- `POST /api/send`: Free 30 requests/minute; Pro 300 requests/minute, keyed by API key.
- A `429` includes `Retry-After` in seconds according to the limits page.
- Subject maximum: 998 characters.
- HTML: Free 2 MB; Pro 5 MB.
- Text: Free 1 MB; Pro 2 MB.
- `to`, `cc`, and `bcc`: maximum 50 each.
- Free monthly send cap: 3,500; Pro is documented as unlimited.
- Personal Gmail daily: Free 200; Pro 500.
- Workspace daily: Free 1,000; Pro 2,000.

Plan-specific limits that the SDK cannot discover should remain server-authoritative. The SDK may enforce universal structural requirements but should avoid rejecting a request based on an assumed account tier.

## Document discrepancies and gaps

1. **`from` requirement:** the basic-send field list calls it required, but the same page says omission defaults to the first account. Template docs explicitly make it conditional. SDK resolution: optional, with documentation warning for multiple accounts.
2. **Custom text-only mode:** text has a documented size limit but is described as an optional fallback, not a standalone custom body. SDK resolution: require HTML for the initially documented custom input.
3. **Single/template success response:** no status code or JSON schema/example is published. SDK resolution: v1 guarantees only the optional documented debug container and preserves every other field as `unknown`; an upstream fixture is not required for release.
4. **Debug issue structure:** issue categories are described, but the JSON item shape is absent. SDK resolution: preserve as unknown until verified.
5. **Template extras/overrides:** no documentation confirms subject/body overrides, CC/BCC, Reply-To, recipient arrays, or attachments with template mode. SDK resolution: omit them from the initial template input until confirmed.
6. **Template and recipient variable value types:** examples use strings, but the docs only say object/key-value pairs. SDK resolution: serialize `Record<string, unknown>` unchanged and avoid a guarantee for all JSON types.
7. **Recipient statuses and errors:** only `sent` and `pending`, with null errors, are demonstrated. SDK resolution: forward-compatible status strings and unknown non-null error values.
8. **Error bodies:** statuses and meanings are documented, but complete bodies are not. SDK resolution: defensive parsing.
9. **Idempotency, versioning, and request IDs:** no policy is published. SDK resolution: no POST retries, unversioned documented paths, and no guaranteed request-ID field.

## Immediate-send SDK mapping

The Node SDK exposes the documented `POST /api/send` operation through two views of one implementation:

- `sendlib.emails.send(input, options?)` accepts custom content or the lower-level discriminated template input.
- `sendlib.templates.send(slug, input, options?)` accepts any dashboard template slug.
- Starter-template methods map `verifyEmail`, `passwordReset`, `paymentSuccessful`, `paymentFailed`, `subscriptionExpiring`, and `accountSuspended` to their kebab-case SendLib slugs; `welcome`, `otp`, and `invoice` map directly.

Only verified request fields are serialized. Custom content preserves `from`, `to`, `subject`, `html`, `text`, `replyTo`, `cc`, `bcc`, and attachment objects without content transformation. Template sends preserve optional `from`, the documented single `to`, the selected slug, and open-ended JSON-compatible `data`. The SDK performs no template rendering and supports no undocumented template overrides.

The returned body is preserved as `SendEmailResponse`: optional documented `debug.issues` entries and all unverified fields remain unknown. A template-variable `400` is an API response, not a local template-rendering error, and therefore remains a `SendlibApiError` with its defensively parsed body available as non-enumerable diagnostics.

## Optional future contract evidence

The v1 contract does not require undocumented response fields, so missing upstream samples do not block implementation or release. If SendLib later publishes schemas or a maintainer explicitly approves controlled integration requests, the following sanitized samples would still improve tests and developer ergonomics:

- Successful custom send.
- Successful template send.
- Send response containing zero and one-or-more `debug.issues`.
- Controlled `400`, `401`, `403`, `413`, and `429` responses; a `500` fixture only if safely available.
- Batch response containing a failed recipient and a non-null recipient error.
- Response headers from success, validation failure, and rate-limit responses.

Obtaining these samples requires explicit use of a maintainer-controlled SendLib account/API key and must be done as a separate, approved integration step. No live API request was made during this documentation-only audit. Until evidence exists, successful bodies, error bodies, debug issue entries, non-null recipient errors, and undocumented headers remain `unknown` and are preserved rather than discarded.
