# SendLib Node SDK implementation checklist

This checklist breaks the work in `../sendlib-node-sdk.md` into reviewable phases. Complete phases in order. Do not begin the next phase until the current phase's exit gate passes.

## How we will use this file

- Check a task only after its implementation and relevant verification are complete.
- Keep one phase active at a time.
- Add links to important pull requests, decisions, or upstream API evidence beside the relevant task.
- If the SendLib API differs from the public documentation, update the contract notes and types before continuing.
- Never place a real SendLib API key, sender, recipient, or message content in source control.
- Use Bun consistently because this project currently has a `bun.lock`. If npm is preferred instead, make that decision in Phase 0, remove the unused lockfile through a deliberate change, and use only one package manager afterward.

## Current state

- [x] Package directory initialized.
- [x] Development dependencies installed.
- [x] `.gitignore` created.
- [x] `.npmignore` created.
- [x] Bun lockfile generated.
- [x] Phase 0 is complete; undocumented response bodies use the forward-compatible policy in `CONTRACT.md` and decision D010.
- [x] Phase 1 package metadata is complete.
- [x] Phase 1 source and build structure is complete.
- [x] Phase 1 linting, formatting, and test tooling is complete.
- [x] Phase 1 is complete.
- [x] Phase 2.1 configuration types are complete.
- [x] Phase 2.2 email input types are complete.
- [x] Phase 2.3 batch types are complete.
- [x] Phase 2.4 send response and debug types are complete within the currently verified public contract.
- [x] Phase 2.5 local validation and validation tests are complete.
- [x] Phase 2.6 non-blocking deliverability analysis is complete.
- [x] Phase 2 is complete within the verified public contract; undocumented upstream response data is preserved as `unknown` and does not block v1.
- [x] Phase 2 completion audit enforces 100% coverage, checks exact documented limits, and compiles dedicated deliverability API fixtures.
- [x] Pre-Phase 3 focused re-audit of Basic Send, Templates, and Batch Send is complete; template selection and Pro-plan error policies are recorded in D011 and D012.
- [x] Phase 3.1 shared HTTP transport is complete; URL, header, serialization, parsing, metadata, and fetch-selection behavior is covered by unit tests and decision D014.
- [x] Phase 3.2 per-request cancellation and attempt timeouts are complete; public call options, abort composition, classification, cleanup, and race behavior are covered by tests and decision D015.
- [x] Phase 3.3 public error hierarchy and transport error mapping are complete; status, unknown-body, abort, timeout, network, and feature-specific behavior is covered by tests and decision D016.
- [x] Phase 3.4 transport redaction is complete; request secrets and content are excluded from errors, transport causes are sanitized, and batch `403` variants share one safe public error (D017).
- [x] Phase 3.5 safe-operation retries are complete; only GET attempts can retry, `Retry-After` and capped full-jitter backoff are supported, and waits are abortable and deterministic in tests (D018).
- [x] Phase 3 is complete; its transport, authentication, error, redaction, timeout, cancellation, and retry exit gate passes with full test coverage.
- [x] Phase 4 single-email API is complete; custom sends, generic and starter-template methods, deliverability access, public exports, synthetic error coverage, and opt-in controlled live-test paths are implemented (D019).
- [x] Phase 5 Pro batch API is complete; create, retrieve, bounded wait, terminal-state errors, pause policy, cancellation, safe GET retries, and an explicitly gated live Pro flow are implemented (D020).
- [x] Phase 6 documentation and governance are complete; the README is the full project homepage, four guarded examples compile and fail closed by default, and contribution, conduct, support, security, issue, and pull-request processes are documented (D021).

---

## Phase 0 — decisions and upstream contract discovery

### Package decisions

- [x] Confirm the permanent package name. Selected: `@sendlib/node-sdk`.
- [x] Check that the intended npm name is available. Confirmed by the maintainer.
- [x] Establish non-misleading community branding. The README and npm description say “unofficial” and “community-maintained,” disclaim sponsorship/endorsement, separate SDK support from SendLib service support, and avoid SendLib logos or copied visual branding.
- [x] Decide whether this package will have its own Git repository. Selected: standalone repository with `master` as its default branch.
- [x] Choose the repository URL, issue tracker URL, and documentation/homepage URL. Selected: `amnesia2k/sendlib-sdk`, its Issues page, and its README homepage.
- [x] Choose and record the package owner and maintainers. Owner: personal GitHub account `amnesia2k`; maintainer: Olatilewa Olatoye (`tilewa.olatoyee@gmail.com`).
- [x] Choose an SPDX license; replace the temporary `ISC` value if another license is selected. Selected: MIT, copyright 2026 Olatilewa Olatoye.
- [x] Confirm Bun as the package manager and record the supported Bun version for contributors. Selected: Bun 1.3.12; npm consumer compatibility remains a required packed-artifact test.
- [x] Choose the minimum supported Node.js version; proposed starting point: Node 22. Selected: Node 22, tested initially on Node 22 and 24 LTS.
- [x] Decide whether v1 publishes dual ESM/CommonJS output or ESM-only output. Selected: dual ESM/CommonJS with ESM as the canonical source format.
- [x] Select the first public release version: `0.1.0`.
- [x] Decide whether Changesets will manage versions and changelogs. Selected: Changesets with semantic versioning.

### SendLib contract verification

- [x] Search for a public SendLib OpenAPI document. None was listed in the sitemap or discoverable through search; common OpenAPI/Swagger locations returned `404`. A private specification may still exist.
- [x] Confirm the production base URL: `https://sendlib.samueltuoyo.com`. Confirmed by the docs and maintainer.
- [x] Confirm Bearer authentication remains the recommended default. Confirmed by the docs and maintainer.
- [x] Confirm whether the `x-api-key` authentication alternative should be public SDK functionality. Documented by SendLib and approved by the maintainer.
- [x] Audit the success response for a custom `POST /api/send` request. Result: no complete success status/schema/example is publicly documented; preserve undocumented fields as `unknown` instead of blocking v1 on a fixture.
- [x] Audit the success response for a template `POST /api/send` request. Result: no separate success response is publicly documented; use the same defensive unknown-field policy without assuming a custom-send shape.
- [x] Audit the shape and stability of `debug.issues`. Result: the property and human-readable issue categories are documented, but item fields and stability are not; preserve issues as unknown until verified.
- [x] Resolve documented `from` ambiguity. SDK decision: make it optional because the docs describe first-account defaulting and template examples omit it; warn that multiple connected accounts require it.
- [x] Confirm documented custom body requirements. SDK decision: require `subject` + `html`; keep `text` optional because it is documented only as a fallback. Do not advertise text-only custom sends yet.
- [x] Audit template subject/body overrides. Result: not documented; model template and custom-content inputs as mutually exclusive.
- [x] Audit accepted template `data` value types. Result: an object is required and examples use strings, but no exhaustive value types are published; serialize `Record<string, unknown>` unchanged without guaranteeing all values.
- [x] Confirm documented attachment behavior. `filename` and base64 string `content` are required; MIME `type` is optional. Encoding variants/inference are not documented and remain server-authoritative.
- [x] Confirm documented batch-create and batch-status fields. Captured exactly in contract fixtures.
- [x] Audit recipient statuses returned inside a batch. Only `sent` and `pending` are demonstrated; the full list and non-null error shape are not documented, so parsing must be forward-compatible.
- [x] Confirm all documented top-level batch statuses: `queued`, `processing`, `paused_limit_reached`, `done`, and `failed`.
- [x] Audit error schemas for `400`, `401`, `403`, `413`, `429`, and `500`. Status meanings are documented and `400` mentions `message`, but complete JSON bodies are not; parse unknown JSON/text defensively.
- [x] Audit request/correlation IDs. No response field or header is documented; do not guarantee one in the public API.
- [x] Audit POST idempotency support. No idempotency key is documented; never automatically retry ambiguous POST failures.
- [x] Audit API versioning. Current routes are unversioned and no policy is published; do not invent a version prefix.
- [x] Capture every success response explicitly published by the docs. Batch-create and processing-status fixtures are stored in `test/fixtures/contracts`; no complete single/template/error responses are published to capture.
- [x] Record documentation differences and gaps in `CONTRACT.md`.
- [x] Re-audit the current Basic Send, Templates, and Batch Send pages immediately before Phase 3 and make them the authoritative v1 endpoint scope.
- [x] Record all nine documented starter template slugs and their displayed variables without treating editable dashboard variables as a permanent schema.
- [x] Confirm that batch sending is Pro-only and that the documented Free-plan outcome is HTTP `403`; no response body or plan-inspection endpoint is documented.

### Phase 0 exit gate

- [x] All package identity/runtime/module-format decisions are documented.
- [x] No required v1 request or response shape remains guessed; undocumented response and error values are preserved as `unknown`.
- [x] Every response fixture published by SendLib is captured. Missing immediate-send/error examples are handled with synthetic transport fixtures and are not represented as official contract evidence.
- [x] The first release version and package manager are confirmed.

---

## Phase 1 — package foundation and developer tooling

### Package metadata

- [x] Set the final `name`. Selected: `@sendlib/node-sdk`.
- [x] Set the initial version. Selected: `0.1.0`.
- [x] Write a clear community-maintained package description.
- [x] Add keywords such as `sendlib`, `email`, `transactional-email`, `typescript`, and `nodejs`.
- [x] Set author/contributors and maintainer information. Maintainer: Olatilewa Olatoye (`tilewa.olatoyee@gmail.com`).
- [x] Set the selected license. Selected: MIT, with the full license text in `LICENSE`.
- [x] Add `repository`, `bugs`, and `homepage` fields for `amnesia2k/sendlib-sdk`.
- [x] Add the selected `engines.node` range. Selected: Node.js `>=22`.
- [x] Add a `packageManager` field with the exact Bun version. Selected: `bun@1.3.12`.
- [x] Set `private: false`.
- [x] Add `publishConfig.access: public`. This is explicit release intent; the package is unscoped and therefore public by default.
- [x] Add `sideEffects: false`. The SDK is designed as a side-effect-free library; this must remain true as source modules are added.

### Source and build structure

- [x] Create `src/`.
- [x] Create `src/index.ts` as the only initial public entry point.
- [x] Create `src/client.ts`.
- [x] Create `src/types.ts`.
- [x] Create `src/errors.ts`.
- [x] Create `src/version.ts`.
- [x] Create `src/internal/` for non-public implementation helpers.
- [x] Create `test/unit/`, `test/contract/`, `test/integration/`, and `test/fixtures/`.
- [x] Create `examples/`.
- [x] Create `tsconfig.json` with strict compiler settings.
- [x] Enable `strict`.
- [x] Enable `noUncheckedIndexedAccess`.
- [x] Enable `exactOptionalPropertyTypes`.
- [x] Enable `useUnknownInCatchVariables`.
- [x] Set the compilation target for the minimum supported Node version. Selected: `ES2022`/`node22`.
- [x] Configure `tsup` for the chosen ESM/CommonJS output.
- [x] Generate `.d.ts`, `.d.cts`, declaration maps, and JavaScript source maps. `tsup` emits JavaScript, TypeScript emits ESM declarations through `tsconfig.build.json`, and the declaration build creates CommonJS declaration counterparts.
- [x] Configure package `main`, `module`, `types`, and conditional `exports` correctly.
- [x] Add a `files` allowlist so only intended artifacts and documentation are published.

### Linting, formatting, and test tooling

- [x] Create the ESLint flat configuration.
- [x] Configure strict, type-aware TypeScript linting for source, tests, and TypeScript configuration files.
- [x] Create the Prettier configuration.
- [x] Create `.prettierignore`.
- [x] Create the Vitest configuration.
- [x] Configure text, JSON, HTML, and LCOV coverage output with 90% initial thresholds.
- [x] Add scripts: `clean`, `build`, `dev`, and `typecheck`.
- [x] Add scripts: `lint`, `format`, and `format:check`.
- [x] Add scripts: `test`, `test:unit`, `test:contract`, `test:integration`, and `test:coverage`.
- [x] Add scripts: `check:exports`, `pack:check`, `ci`, and `prepublishOnly`.
- [x] Make `prepublishOnly` run the complete CI suite followed by strict package/type checks.

### Ignore files and repository basics

- [x] Expand `.gitignore` to cover `dist/`, `coverage/`, `.env*`, tarballs, logs, caches, alternate lockfiles, temporary files, and editor/OS artifacts.
- [x] Explicitly allow `.env.example` in `.gitignore`.
- [x] Prefer the `package.json` `files` allowlist as the publishing boundary. The allowlist contains `dist`, `README.md`, `LICENSE`, and `CHANGELOG.md`.
- [x] Remove the redundant empty `.npmignore` after selecting the `package.json` `files` allowlist as the authoritative publishing boundary.
- [x] Add `.editorconfig`.
- [x] Add `.env.example` containing only `SENDLIB_API_KEY=sl_your_api_key_here`.
- [x] Add initial `README.md` with a prominent community/unofficial notice.
- [x] Add the selected `LICENSE` file.
- [x] Add `CHANGELOG.md` with the initial unreleased `0.1.0` entry and Changesets/SemVer policy.

### Package smoke tests

- [x] Build the empty public entry point successfully. Verified for ESM and CommonJS with JavaScript source maps plus `.d.ts`/`.d.cts` declarations and maps.
- [x] Generate a real package tarball without publishing it in an isolated temporary workspace.
- [x] Inspect the installed tarball contents. Verified exactly 16 intended files across package metadata, documentation, runtime builds, source maps, and declarations.
- [x] Run `publint` against the packed package. Strict analysis passed.
- [x] Run `@arethetypeswrong/cli` against the packed package. Strict ESM, CommonJS, bundler, and package JSON resolution checks passed.
- [x] Install the tarball with npm into a clean temporary ESM consumer and execute its import.
- [x] Install the tarball with npm into a clean temporary CommonJS consumer and execute its require.
- [x] Confirm ESM `.d.ts` and CommonJS `.d.cts` types resolve under strict TypeScript `NodeNext` consumers.

### Phase 1 exit gate

- [x] Formatting, linting, type checking, tests, and build pass from an isolated clean source copy installed with the frozen Bun lockfile.
- [x] The tarball contains only expected files. The smoke script rejects any unexpected top-level package entry and asserts required runtime/type entry points.
- [x] Every advertised module format imports correctly in a clean npm consumer.
- [x] No application/API behavior has been implemented prematurely. Only build scaffolding and the package `VERSION` export exist.

---

## Phase 2 — public types and local validation

### Configuration types

- [x] Define readonly `SendlibOptions` and export it from the package entry point.
- [x] Include required `apiKey` with server-side secret guidance.
- [x] Include optional `baseUrl`.
- [x] Include optional `authMode`; Phase 0 approved both `bearer` and `x-api-key`.
- [x] Include optional `timeoutMs`.
- [x] Include optional `maxRetries` for operations classified as safe to retry; this never opts ambiguous POST requests into retries.
- [x] Include an injectable Fetch-compatible transport through the exported `SendlibFetch` type.
- [x] Evaluate optional caller/SDK user-agent configuration. Deferred because SendLib has not approved an SDK header and callers do not need arbitrary header access in v1.
- [x] Define and document defaults once in `src/internal/config.ts`: SendLib production URL, Bearer auth, 30-second attempt timeout, and two safe-operation retries.

### Email input types

- [x] Define reusable plain-string `EmailAddress` and single-or-readonly-array `EmailRecipient` types without pretending TypeScript can prove email validity.
- [x] Define readonly `Attachment` with `filename`, base64 `content`, and optional MIME `type`.
- [x] Define readonly `CustomEmailInput`.
- [x] Require `subject` for custom-content sends.
- [x] Model the documented body requirement by requiring `html`; `text` remains an optional fallback. Text-only custom sends remain excluded pending upstream verification.
- [x] Define readonly `TemplateEmailInput` separately.
- [x] Require `template` and readonly `data` according to the verified contract.
- [x] Define the structurally discriminated `SendEmailInput` union and use `never` properties so custom and template modes cannot be mixed accidentally.
- [x] Model custom `to`, `cc`, `bcc`, `replyTo`, and `from`, while limiting template mode to its documented single `to` and optional `from`.
- [x] Use readonly properties, recipient arrays, attachment arrays, and template-data records so the SDK contract never requires mutation of caller-owned inputs.

### Batch types

- [x] Define readonly `BatchRecipient` with `email` and optional readonly `variables`.
- [x] Define readonly `CreateBatchInput` for the documented Pro-only endpoint.
- [x] Model at least one of batch `html` or `text` with a union that also permits both.
- [x] Exclude attachments from the batch type with an optional `never` property.
- [x] Define all documented aggregate batch statuses as the closed `BatchStatus` string union.
- [x] Define the demonstrated batch-recipient statuses and allow unknown future strings because SendLib does not publish an exhaustive list.
- [x] Define `CreateBatchResponse` from the sanitized documented fixture.
- [x] Define `BatchStatusResponse` and `BatchRecipientResult` from the sanitized documented fixture, preserving undocumented non-null recipient errors as `unknown`.
- [x] Define bounded `WaitForBatchOptions` with finite interval/timeout defaults, cancellation, and explicit paused-limit behavior; centralize immutable defaults in `src/internal/config.ts`.

### Send response and debug types

- [x] Define `SendEmailResponse` from verified public facts only. No send success fixture exists, so the type deliberately guarantees no success flag, message ID, or other undocumented field.
- [x] Represent `debug.issues` as a readonly `unknown[]`; SendLib has not published a stable issue-entry structure, so the SDK does not invent one.
- [x] Preserve unknown current and future response/debug fields through readonly string index signatures.
- [x] Keep `debug` and `issues` optional and avoid marking any undocumented response field as guaranteed.

### Local validation

- [x] Reject a missing, empty, or whitespace-only API key.
- [x] Validate `baseUrl` as an absolute HTTP(S) URL.
- [x] Validate finite, nonnegative timeout/retry values and require integer retry counts.
- [x] Validate required strings and non-empty recipient arrays.
- [x] Validate the documented custom HTML requirement and at least one batch body.
- [x] Enforce the universal 50-address immediate-send field maximum, 998-character subject maximum, and 2,000-recipient absolute batch ceiling.
- [x] Reject batch attachments at both type and runtime boundaries.
- [x] Validate attachment object shape without copying or decoding base64 content.
- [x] Keep server-side validation authoritative for plan-specific limits, email deliverability, HTML correctness, MIME/base64 details, and account-specific batch limits.

### Tests

- [x] Test every accepted input mode.
- [x] Test every locally rejected input category.
- [x] Test optional-field omission versus explicit `undefined` behavior; omission is accepted and explicit `undefined` is rejected consistently with `exactOptionalPropertyTypes`.
- [x] Test frozen inputs and serialized before/after values to prove validation does not mutate them.
- [x] Test type-level valid/invalid examples with compilation fixtures and `@ts-expect-error`.

### Deliverability guidance

- [x] Export a deterministic `analyzeDeliverability` utility for immediate and batch inputs.
- [x] Detect the documented advisory signals: urgent/commercial phrases, multiple links, image-heavy or embedded-image HTML, prominent button markup, missing plain-text fallback, and a missing sender display name.
- [x] Return explicit manual checks for expected recipients, rendered template content, and image/layout size where source data cannot prove compliance.
- [x] Keep reports non-blocking, immutable, and free of subjects, bodies, addresses, matched text, or other caller content.
- [x] Do not rewrite messages, reject API-valid requests, log warnings automatically, or claim that passing heuristics guarantees inbox placement.

The Phase 4 client exposes this same implementation through `sendlib.deliverability.analyze(input)`; there is no duplicate analyzer or automatic send-time enforcement.

### Phase 2 exit gate

- [x] Public request/response/configuration types match the verified documentation and available batch fixtures; unverified send fields remain safely `unknown`.
- [x] Invalid deterministic inputs fail synchronously in internal validators; client phases must invoke these before transport calls.
- [x] Type-level and runtime validation tests pass with 100% statement, branch, function, and line coverage, enforced by Vitest thresholds.

---

## Phase 3 — transport, authentication, and error model

### HTTP transport

- [x] Create one internal request function used by every endpoint.
- [x] Resolve fixed endpoint paths safely against `baseUrl`, retaining intentional proxy path prefixes.
- [x] Use the injected Fetch-compatible function when provided.
- [x] Use Node's platform `fetch` by default.
- [x] Add `Accept: application/json`.
- [x] Add `Content-Type: application/json` only when a JSON body exists.
- [x] Add Bearer authentication by default.
- [x] Add the Phase 0-approved `x-api-key` mode.
- [x] Do not add an SDK user-agent/version header: SendLib has not approved one, and Phase 2 deliberately excluded caller configuration for it.
- [x] Serialize JSON predictably and reject runtime values for which `JSON.stringify` returns no representation.
- [x] Parse successful JSON responses, including arrays and primitive JSON values.
- [x] Preserve status, status text, URL, and cloned response headers in the internal response envelope for later safe endpoint/error handling.
- [x] Handle empty, whitespace-only, text, and malformed-JSON responses without throwing unrelated parser errors.

### Cancellation and timeout

- [x] Implement request timeouts with `AbortController`, using the client default or a per-call override.
- [x] Export readonly `SendlibCallOptions` with `signal` and `timeoutMs` for endpoint methods.
- [x] Correctly compose timeout and caller cancellation while preserving the first abort source during a race.
- [x] Clean up timeout resources and caller-signal listeners after every request outcome.
- [x] Distinguish timeout from explicit caller cancellation through the internal transport abort kind for Phase 3.3 error mapping.

### Error classes

- [x] Implement `SendlibError`.
- [x] Implement `SendlibConfigError`.
- [x] Implement `SendlibValidationError`.
- [x] Implement `SendlibApiError`.
- [x] Implement `SendlibAuthenticationError` for `401`.
- [x] Implement `SendlibForbiddenError` for `403`.
- [x] Implement `SendlibPlanRequiredError` as a `SendlibForbiddenError` subtype for `403` responses from batch endpoints, with stable `feature: 'batch'` and `requiredPlan: 'pro'` properties.
- [x] Implement `SendlibPayloadTooLargeError` for `413`.
- [x] Implement `SendlibRateLimitError` for `429`.
- [x] Implement `SendlibTimeoutError`.
- [x] Implement `SendlibAbortError` for explicit caller cancellation.
- [x] Implement `SendlibNetworkError`.
- [x] Store HTTP status, optional upstream string fields, optional `x-request-id`, and parsed `retryAfterMs` metadata.
- [x] Preserve undocumented success/error bodies as `unknown`; never require an upstream `message`, `code`, or JSON object shape.
- [x] Support standard `cause` while keeping SDK-authored default messages independent of the cause.

### Redaction

- [x] Never place the API key or authorization header in an error.
- [x] Never include full request bodies, attachment content, or recipient lists in default error messages.
- [x] Redact sensitive headers in any diagnostic metadata.
- [x] Add tests that intentionally use a recognizable fake secret and prove it cannot appear in serialized/thrown errors.
- [x] Test batch `403` handling with object, text, malformed, and empty bodies; every case must throw the same safe `SendlibPlanRequiredError` without leaking request data.

### Retry behavior

- [x] Implement `Retry-After` parsing for both delta seconds and HTTP dates.
- [x] Implement exponential backoff with jitter for approved safe operations.
- [x] Do not automatically retry `POST /api/send`.
- [x] Do not automatically retry `POST /api/batch` unless verified idempotency support makes it safe.
- [x] Allow bounded retries for batch-status GET on transient network failures, `429`, and selected `5xx` responses.
- [x] Make all retry limits observable and testable without real delays.

### Phase 3 exit gate

- [x] Transport tests cover success, every mapped error, malformed responses, timeouts, cancellation, and redaction.
- [x] No POST operation can be duplicated by an automatic ambiguous retry.
- [x] Safe retries honor limits and `Retry-After`.

---

## Phase 4 — single-email API

### Client surface

- [x] Implement the `Sendlib` client constructor.
- [x] Expose `sendlib.emails.send(input, options?)`.
- [x] Expose the plural `sendlib.templates` namespace.
- [x] Expose `sendlib.deliverability.analyze(input)` as a thin alias of the exported analyzer without automatic logging or blocking sends.
- [x] Export the client, email types, call options, and relevant errors from `src/index.ts`.
- [x] Avoid a default export.

### Custom email sending

- [x] Map `from` exactly as provided, including display-name format.
- [x] Map string and array `to` values.
- [x] Map `subject`, `html`, and `text` without transforming email content.
- [x] Map `replyTo`, `cc`, and `bcc`.
- [x] Map attachments without decoding/re-encoding base64 content.
- [x] Return the typed upstream success response.
- [x] Preserve typed `debug.issues`.

### Template sending

- [x] Map template slug and interpolation `data`.
- [x] Apply verified `from` optionality.
- [x] Surface missing-template-variable `400` responses as typed API/validation errors without losing upstream details.
- [x] Do not implement a local template renderer.
- [x] Expose `sendlib.templates.send(slug, input)` for arbitrary dashboard template slugs and future upstream additions.
- [x] Define and export readonly `TemplateSendInput` for template namespace methods without requiring callers to repeat the selected slug.
- [x] Add convenience methods for `welcome`, `verifyEmail`, `passwordReset`, `otp`, `invoice`, `paymentSuccessful`, `paymentFailed`, `subscriptionExpiring`, and `accountSuspended`.
- [x] Map every camelCase convenience method to its exact documented kebab-case slug.
- [x] Keep template `data` as readonly `Record<string, unknown>` because dashboard edits can change required variables; document current starter variables as hints rather than a frozen schema.
- [x] Keep `sendlib.emails.send({ template, ... })` as a compatible lower-level path rather than maintaining two different implementations.

### Tests and fixtures

- [x] Test the exact request for a minimal custom HTML email.
- [x] Test documented custom HTML and combined HTML/text messages; do not advertise text-only custom sends unless SendLib documents them.
- [x] Test display-name sender.
- [x] Test multiple `to`, `cc`, and `bcc` recipients.
- [x] Test Reply-To.
- [x] Test one and multiple attachments.
- [x] Test template sends and nested/primitive data values accepted by the API.
- [x] Test generic custom template slugs and all starter convenience-method slug mappings without making live sends.
- [x] Test documented single-send error statuses with synthetic unknown JSON, text, malformed, and empty bodies; do not label them as upstream fixtures.
- [x] Test preservation of debug issues and unknown safe fields.
- [x] Add one opt-in controlled live custom send.
- [x] Add one opt-in controlled live template send using a dedicated test template.

### Phase 4 exit gate

- [x] All documented single-send modes are implemented and tested.
- [x] Controlled live custom and template tests run only when all opt-in integration settings are present; they remain intentionally unexecuted without maintainer credentials.
- [x] No integration send runs by default or on untrusted pull requests.

---

## Phase 5 — batch API and bounded polling

### Batch creation

- [x] Expose `sendlib.batches.create(input, options?)`.
- [x] Send `POST /api/batch` and accept the verified `202` response.
- [x] Support per-recipient interpolation variables.
- [x] Preserve the returned `batchId`, total, and status.
- [x] Document and type the Pro-only requirement.
- [x] On batch-endpoint `403`, throw `SendlibPlanRequiredError` with status 403, feature `batch`, required plan `pro`, and the upstream body preserved as `unknown`.
- [x] Do not make an undocumented account-plan preflight request and do not retry a batch `403`.
- [x] Ensure attachments cannot reach this endpoint.

### Batch retrieval

- [x] Expose `sendlib.batches.retrieve(batchId, options?)`.
- [x] Validate a non-empty batch ID.
- [x] URL-encode the batch ID safely.
- [x] Parse aggregate status, counts, progress, and recipient results.
- [x] Preserve recipient message IDs and errors according to the verified contract.

### Wait helper

- [x] Expose `sendlib.batches.wait(batchId, options?)`.
- [x] Require a finite overall timeout.
- [x] Use a configurable positive polling interval.
- [x] Support `AbortSignal`.
- [x] Stop on `done`.
- [x] Stop and return/throw according to the documented policy for top-level `failed`.
- [x] Define and test the behavior for `paused_limit_reached`.
- [x] Never poll indefinitely.
- [x] Do not create another batch while polling.
- [x] Use safe GET retry rules without multiplying the polling rate.

### Tests and integration

- [x] Test exact batch-create request JSON.
- [x] Test the stable Free-plan `SendlibPlanRequiredError` mapping independently of any undocumented upstream response-body shape.
- [x] Test all top-level batch statuses.
- [x] Test the demonstrated `sent` and `pending` recipient statuses plus preservation of an unknown future status.
- [x] Test URL encoding of IDs.
- [x] Test terminal completion.
- [x] Test top-level failure.
- [x] Test daily-limit pause behavior.
- [x] Test polling timeout and abort.
- [x] Test rate limits and transient GET retries with deterministic zero-delay test responses.
- [x] Add an opt-in Pro-account live test for a tiny approved batch.
- [x] Poll the controlled live batch to a terminal state without issuing duplicate creates.

### Phase 5 exit gate

- [x] Create, retrieve, and wait APIs pass unit and contract tests.
- [x] Every documented status has explicit behavior.
- [x] The controlled Pro integration test runs only with both live-test gates and required maintainer settings; it remains intentionally unexecuted without a Pro credential and approved recipient.

---

## Phase 6 — documentation, examples, and project governance

### README

- [x] Add community/unofficial status and support boundaries at the top.
- [x] Add Node/module-format compatibility table.
- [x] Add installation commands using the selected package manager plus npm consumer commands.
- [x] Explain how to connect Gmail and create a SendLib API key.
- [x] Explain `SENDLIB_API_KEY` setup and why the SDK does not load `.env` itself.
- [x] Add a minimal first-send example.
- [x] Add custom HTML/text and display-name examples.
- [x] Add CC/BCC/Reply-To example.
- [x] Add base64 attachment example with size warnings.
- [x] Add template and interpolation example.
- [x] Document generic template sending plus all starter convenience methods and their current variable hints.
- [x] Add batch create/retrieve/wait examples and a focused polling-state flowchart.
- [x] Label batch sending as Pro-only and attachment-free.
- [x] Show `SendlibPlanRequiredError` handling for Free-plan batch attempts.
- [x] Add typed error handling and rate-limit examples.
- [x] Document timeout, abort, and retry behavior; custom Fetch and test-base-URL guidance was removed from the public README at the maintainer's request while the typed options remain available.
- [x] Document quotas and transactional/deliverability expectations.
- [x] Add security guidance and warn against browser usage.
- [x] Link the live SendLib docs and this project's issue tracker/security policy.

### Executable examples

- [x] Create `examples/basic-send.ts`.
- [x] Create `examples/template-send.ts`.
- [x] Create `examples/attachment.ts`.
- [x] Create `examples/batch-send.ts`.
- [x] Use only environment-provided credentials and placeholder recipients.
- [x] Compile every example in `bun run ci` through the dedicated examples TypeScript project.
- [x] Ensure examples cannot send accidentally without explicit environment setup; the CI safety check executes all four with opt-in disabled and requires them to fail at the guard.

### Governance and support

- [x] Complete `CONTRIBUTING.md` with setup, commands, tests, and PR expectations.
- [x] Complete `CODE_OF_CONDUCT.md`.
- [x] Complete `SECURITY.md` with GitHub private vulnerability reporting and direct maintainer email fallbacks.
- [x] Define the supported-version and deprecation policy.
- [x] Define how upstream API contract drift will be handled.
- [x] Add issue templates for bugs, features, and API contract changes.
- [x] Add a pull-request template.
- [x] Do not add `CODEOWNERS` while the repository has one maintainer; add it if ownership expands.

### Phase 6 exit gate

- [x] A new user can install, configure, send, handle errors, and use batches using only the README.
- [x] Every published example compiles.
- [x] Contribution, conduct, support, and security processes are documented.

---

## Phase 7 — CI, package integrity, and security hardening

### Continuous integration

- [x] Add a GitHub Actions CI workflow.
- [x] Run on pull requests and pushes to protected branches.
- [x] Install dependencies from the lockfile without modifying it using `bun ci`.
- [x] Run format check.
- [x] Run lint.
- [x] Run type checking.
- [x] Run unit and contract tests.
- [x] Enforce coverage thresholds.
- [x] Run a clean build.
- [x] Test every advertised Node version through the Node.js 22 and 24 matrix.
- [x] Test every advertised module format in packed consumer fixtures.
- [x] Run `publint` and `@arethetypeswrong/cli` on the generated package.
- [x] Upload short-lived coverage/build diagnostics without injecting secrets or running live tests.

### Security and dependency maintenance

- [x] Enable GitHub native secret scanning, push protection, Dependabot alerts, and Dependabot security updates; retain the code-level repository/package scanner as an additional gate.
- [x] Enable Bun and GitHub Actions dependency update automation with Dependabot.
- [x] Establish `amnesia2k` as the owner for dependency/security alerts and document the private reporting route.
- [x] Keep integration secrets unavailable to fork pull requests: PR CI has read-only permissions, references no secrets, and never runs live tests.
- [x] Protect the `sendlib-live` GitHub environment with required maintainer approval and a `master`-only deployment policy. Dedicated test secrets are intentionally absent until controlled live testing is enabled.
- [x] Enforce credential separation through isolated local-development, `sendlib-live`, and `npm-production` configuration boundaries; never copy credentials between them.
- [x] Scan the repository and the unpacked package tarball for high-confidence secret patterns with redacted findings.
- [x] Review production dependencies and justify each one. The package currently declares no production/runtime dependencies.
- [x] Confirm no runtime validation/build dependency was bundled accidentally. Package analysis reported no bundled dependencies.

### Repository protections

- [x] Protect the `master` branch with an active GitHub ruleset that requires pull requests and blocks deletion and force pushes.
- [x] Require the Node 22, Node 24, and package-integrity CI checks to pass against the current branch before merging.
- [x] Require pull-request review for all repository changes, including release workflow changes.
- [x] Protect `v*` release tags with an active ruleset and protect the `npm-production` environment with required approval and a tag-only deployment policy.

### Phase 7 exit gate

- [x] The entire quality matrix passes in CI from a clean clone on Node.js 22 and 24, including package integrity.
- [x] Pull requests cannot access publishing or live SendLib secrets; ordinary CI references neither protected environment.
- [x] Package consumers receive no unintended dependencies or files; the package has no runtime dependencies and the packed-file allowlist/consumer smoke checks pass.

---

## Phase 8 — release candidate and npm publishing

### npm and release setup

- [ ] Create/confirm the npm organization or maintainer account.
- [ ] Enable npm two-factor authentication.
- [ ] Configure npm trusted publishing/OIDC from the protected repository when available.
- [ ] If OIDC is unavailable, create a granular publish token restricted to this package and store it only in the protected release environment.
- [ ] Add Changesets and initialize its configuration if selected in Phase 0.
- [ ] Add the automated version/release workflow.
- [ ] Require human approval for production publishing.
- [ ] Configure provenance publishing.

### Release preparation

- [ ] Freeze and review the public API.
- [ ] Confirm all Phase 0 contract questions are resolved or explicitly deferred without unsafe guesses.
- [ ] Confirm version, changelog, license, package metadata, exports, and support table.
- [ ] Run the complete CI matrix at the release commit.
- [x] Run `bun pm pack --dry-run` or the selected equivalent. Both Bun and npm dry-run package previews succeeded.
- [ ] Inspect the final tarball file list and unpacked content.
- [ ] Search the final tarball and repository history for credentials/personal test data.
- [ ] Install the exact tarball into clean ESM and supported CommonJS consumers.
- [ ] Run type and runtime smoke tests against the exact tarball.

### Candidate publishing

- [ ] Publish the first candidate with the `next` dist-tag, public access, and provenance.
- [ ] Confirm npm displays the correct README, license, repository, types, and provenance.
- [ ] Install `package@next` into a clean external consumer.
- [ ] Run controlled custom and template send smoke tests with the installed artifact.
- [ ] Run the controlled Pro batch smoke test if batch support is included in this release.
- [ ] Verify errors and redaction from the installed artifact.
- [ ] Collect maintainer/user feedback and fix candidate issues with new immutable versions.

### Stable promotion

- [ ] Approve the candidate for stable release.
- [ ] Promote the exact tested version to `latest` using an npm dist-tag; do not rebuild it.
- [ ] Create the matching Git tag.
- [ ] Create GitHub release notes from the changelog.
- [ ] Verify a fresh `npm install <package>` resolves the promoted version.
- [ ] Verify imports, types, and one controlled smoke send after promotion.
- [ ] Announce the release with the community/unofficial status intact.

### Phase 8 exit gate

- [ ] The npm artifact has correct contents, types, metadata, and provenance.
- [ ] The exact candidate tested is the artifact promoted to `latest`.
- [ ] Clean consumers can install and use all advertised functionality.
- [ ] No credentials or unintended files were published.

---

## Phase 9 — post-release maintenance and NestJS handoff

### Post-release monitoring

- [ ] Monitor installation, module-format, type, and upstream-contract issues.
- [ ] Triage security reports privately and promptly.
- [ ] Track SendLib documentation/API changes.
- [ ] Periodically re-run controlled contract tests.
- [ ] Keep dependencies and the supported Node matrix current.
- [ ] Document any deprecation before removing public behavior.

### Bad-release procedure

- [ ] Never attempt to overwrite an existing npm version.
- [ ] Deprecate a broken version with a useful message.
- [ ] Move `latest` only to a previously verified safe version when rollback is necessary.
- [ ] Publish a fixed patch/minor/major version according to semantic-versioning impact.
- [ ] Publish a security advisory when appropriate.

### NestJS SDK handoff

- [ ] Publish a stable Node SDK version suitable for use as the Nest package's runtime dependency.
- [ ] Document which Node SDK APIs/types/errors the Nest adapter should expose.
- [ ] Confirm the compatible dependency range for the Nest package.
- [ ] Provide packed/published Node artifacts to the Nest compatibility tests.
- [ ] Coordinate breaking changes so the Nest adapter can update safely.

### Phase 9 exit gate

- [ ] Maintenance ownership and contract-monitoring routines are active.
- [ ] The Node SDK is ready to be consumed rather than reimplemented by `sendlib-nest-sdk`.

---

## Overall definition of done

- [ ] Every documented SendLib v1 email and batch operation in scope is typed, implemented, and tested.
- [ ] Public types are based on verified responses rather than assumptions.
- [ ] Secrets and personal email data are protected in errors, logs, tests, CI, and package artifacts.
- [ ] Ambiguous POST failures cannot trigger automatic duplicate emails.
- [ ] The README and executable examples are sufficient for a first-time consumer.
- [ ] CI validates every advertised Node and module-format combination.
- [ ] The published package installs cleanly, exposes correct types, and includes npm provenance.
- [ ] The NestJS SDK can use this package as its single transport and error-contract dependency.
