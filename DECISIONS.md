# SendLib Node SDK decision log

This file records decisions that affect the public package or its maintenance. It should be updated when a decision changes, together with any necessary migration notes.

## D001 — Package identity

- Status: accepted
- Date: 2026-09-11
- npm package name: `@sendlib/node-sdk`
- Initial public version: `0.1.0`
- Positioning: community-maintained and unofficial unless SendLib explicitly adopts it later
- Repository model: standalone Git repository using `master` as the default branch
- GitHub owner: `amnesia2k` (personal account, not an organization)
- Repository: <https://github.com/amnesia2k/sendlib-sdk>
- Issues: <https://github.com/amnesia2k/sendlib-sdk/issues>
- Package homepage: <https://github.com/amnesia2k/sendlib-sdk#readme>
- Maintainer: Olatilewa Olatoye (`tilewa.olatoyee@gmail.com`)

The scoped package name was selected by the maintainer. Publishing it requires npm publish access to the `sendlib` scope. Public descriptions and documentation must not imply that the package is an official SendLib product. The npm description begins with “Unofficial, community-maintained,” and the README begins with a prominent non-affiliation notice. SDK support is routed to this repository; service/account support is routed to SendLib's official channels.

## D002 — License

- Status: accepted
- Date: 2026-09-11
- Decision: MIT
- Copyright holder: Olatilewa Olatoye

MIT is widely understood by Node.js package consumers and permits broad community and commercial use. The complete license text is stored in `LICENSE`.

## D003 — Runtime support

- Status: accepted
- Date: 2026-09-11
- Minimum Node.js version: 22
- Initial CI runtime matrix: Node.js 22 and Node.js 24

Node.js 20 is end-of-life. Node.js 22 and 24 are maintained LTS lines as of this decision. The SDK will use Node's built-in `fetch` and will not advertise support for end-of-life runtimes. The matrix must be reviewed before each major release.

Reference: <https://nodejs.org/en/about/previous-releases>

## D004 — Module formats

- Status: accepted
- Date: 2026-09-11
- Decision: publish both ESM and CommonJS from one TypeScript source tree

ESM is the canonical source format. `tsup` will produce separate ESM and CommonJS artifacts plus TypeScript declarations. Conditional package exports will be tested in clean ESM and CommonJS consumer fixtures before release.

This decision may be revisited in a future major release when CommonJS demand no longer justifies dual publishing.

## D005 — Package manager

- Status: accepted
- Date: 2026-09-11
- Contributor and CI package manager: Bun 1.3.12
- Committed lockfile: `bun.lock`
- Registry/package format: npm-compatible package published to the npm registry

Bun is a repository tooling choice. It does not require package consumers to use Bun: npm, pnpm, Yarn, and Bun consumers all install the same published npm package and do not use this repository's `bun.lock`.

Contributor and CI installs must use the frozen Bun lockfile (`bun install --frozen-lockfile` or `bun ci`). Do not commit an additional `package-lock.json`, `pnpm-lock.yaml`, or `yarn.lock`. Compatibility will still be validated by installing the packed artifact with npm in clean consumer fixtures.

References:

- <https://bun.sh/docs/pm/lockfile>
- <https://bun.sh/docs/pm/cli/install>
- <https://bun.sh/docs/pm/cli/publish>

## D006 — Versioning and changelog management

- Status: accepted
- Date: 2026-09-11
- Decision: semantic versioning managed with Changesets
- Initial release: `0.1.0`

User-visible changes should normally include a Changeset describing whether the next release is a patch, minor, or major change. Documentation-only or internal changes that do not affect the published package may omit one. Changesets will generate version updates and changelog entries; publishing will ultimately run from protected CI rather than a contributor workstation.

Changesets configuration and scripts will be installed during the package-foundation/release-tooling work. The initial `0.1.0` release will be prepared deliberately rather than generated as an accidental bump from an earlier public release.

Reference: <https://github.com/changesets/changesets>

## D007 — Release stability and API compatibility

- Status: accepted
- Date: 2026-09-11
- Decision: begin at `0.1.0` while the community API matures

Because the first release is `0.1.0`, the SDK follows Semantic Versioning's initial-development rules: minor `0.x` releases may contain breaking changes and must provide clear changelog and migration notes. Patch releases remain backward compatible. Undocumented SendLib response fields will not be presented as guaranteed SDK fields until verified. The project will move to `1.0.0` when the public API is considered stable.

## D008 — Build and declaration pipeline

- Status: accepted
- Date: 2026-09-11
- JavaScript bundler: tsup
- Declaration emitter: TypeScript
- Outputs: ESM `.js`, CommonJS `.cjs`, declarations, declaration maps, and JavaScript source maps

The initially installed TypeScript 7 compiler was newer than the declaration plugin bundled by tsup 8.5.1, and that plugin crashed during declaration generation. The build therefore assigns one responsibility to each tool: tsup bundles JavaScript, while `tsc --project tsconfig.build.json` emits declarations directly. Keeping declaration generation with TypeScript also reduces coupling to tsup's internal Rollup plugin.

The exported SDK version is injected from `package.json` at build time so Changesets remains the single source of truth for release versions.

## D009 — TypeScript toolchain compatibility

- Status: accepted
- Date: 2026-09-11
- Compiler line: TypeScript 6

The project initially had TypeScript 7 installed, but the installed `typescript-eslint` release explicitly does not support its compiler API and cannot start. The project uses the supported TypeScript 6 line so linting, type checking, declaration generation, and CI share one reliable compiler. TypeScript 7 can be reconsidered after the complete toolchain officially supports it and the full CI/package matrix passes.

## D010 — Undocumented API responses

- Status: accepted
- Date: 2026-09-12
- Decision: preserve undocumented success and error response data as `unknown`; upstream fixtures are useful but are not a v1 release requirement

SendLib does not publish complete response schemas for immediate custom sends, template sends, or errors. The SDK must therefore parse bodies defensively, preserve unknown JSON or text, and guarantee only independently documented metadata such as the HTTP status and parsed `Retry-After` where applicable. `SendEmailResponse` exposes the optional documented `debug.issues` array while keeping its entries and every other undocumented field unknown.

This approach prevents upstream response additions or shape changes from breaking SDK parsing. Future verified fields may be exposed additively, but existing raw data must remain accessible. Synthetic transport fixtures will cover object, array, primitive, text, empty, and malformed bodies without pretending they are official SendLib examples.

## D011 — Template sending surface

- Status: accepted
- Date: 2026-09-12
- Decision: expose a plural `sendlib.templates` namespace with a generic send method and convenience methods for documented starter slugs

All template sends use the documented `POST /api/send` endpoint. The generic `sendlib.templates.send(slug, input)` method supports user-created dashboard slugs and future SendLib templates. Convenience methods use JavaScript-friendly camelCase names and map to exact upstream slugs: `welcome`, `verifyEmail`, `passwordReset`, `otp`, `invoice`, `paymentSuccessful`, `paymentFailed`, `subscriptionExpiring`, and `accountSuspended`.

The convenience methods provide discoverability but do not freeze template variable schemas. SendLib templates are edited in the dashboard, so each method accepts readonly `Record<string, unknown>` data and documents the variables currently shown by SendLib. The SDK does not render or manage templates and will surface SendLib's documented `400` for missing variables.

## D012 — Pro-only batch access

- Status: accepted
- Date: 2026-09-12
- Decision: map `403` from documented batch endpoints to a stable plan-required SDK error without preflight plan detection

SendLib documents batch sending as Pro-only and says Free-plan attempts receive `403`, but it publishes no error-body schema and no account-plan inspection endpoint. The SDK will call the requested batch endpoint directly and map a resulting `403` to `SendlibPlanRequiredError`, extending `SendlibForbiddenError`. The error will expose stable SDK-owned values `status: 403`, `feature: 'batch'`, and `requiredPlan: 'pro'`, while retaining the upstream response body as `unknown`.

The SDK must not retry this response, make a speculative plan preflight call, claim it can upgrade the account, or depend on an undocumented upstream message. A `403` from another endpoint remains a general `SendlibForbiddenError`.

## D013 — Deliverability analysis

- Status: accepted
- Date: 2026-09-12
- Decision: implement SendLib's published deliverability advice as an explicit, non-blocking local analyzer

The package exports `analyzeDeliverability` and will expose it through the client as `sendlib.deliverability.analyze`. It returns immutable issue codes and manual-check reminders for locally observable recommendations such as link count, image/button markup, plain-text fallback, display-name format, and documented urgent/commercial language.

The analyzer does not modify messages, reject sends, log automatically, inspect remote image sizes, determine recipient consent, or guarantee inbox placement. Its diagnostics never echo caller content or addresses. Template HTML is stored and rendered upstream, so template analysis is limited to visible sender information plus a manual reminder to review the rendered dashboard template. SendLib's returned `debug.issues` remains a separate upstream diagnostic channel.

## D014 — Shared HTTP transport foundation

- Status: accepted
- Date: 2026-09-12
- Decision: route every endpoint through one Fetch-compatible internal request function

The transport uses an injected Fetch-compatible implementation when provided and Node's platform `fetch` otherwise. It applies Bearer authentication by default, supports the approved `x-api-key` alternative, always requests JSON, and only declares a JSON content type when a request body exists. No SDK user-agent header is sent because SendLib has not approved one.

Endpoint paths are SDK-owned. Resolution retains a configured base-path prefix so test servers and application proxies can use base URLs such as `http://localhost:3000/sendlib`, while discarding base URL query strings and fragments. Dynamic path values must be encoded by the endpoint layer before reaching the transport.

Response bodies are consumed once. Valid JSON objects, arrays, and primitives are returned as parsed unknown data; empty or whitespace-only bodies become `undefined`; and non-JSON or malformed-JSON bodies remain text. The internal envelope retains status, status text, URL, and cloned headers so later error mapping can extract only approved metadata. Phase 3.1 does not map non-success statuses, add timeouts, or retry requests; those behaviors belong to the following Phase 3 steps.

## D015 — Cancellation and attempt timeouts

- Status: accepted
- Date: 2026-09-12
- Decision: compose a bounded per-attempt timeout with optional per-call cancellation

Every transport attempt uses an `AbortController` and the client's configured 30-second timeout by default. Endpoint methods will accept exported `SendlibCallOptions`, allowing a caller-owned `AbortSignal` and an optional nonnegative per-call `timeoutMs` override. A zero timeout means an immediate timeout; batch wait's separate `timeoutMs` remains the overall polling bound rather than an individual request timeout.

The first abort source wins when caller cancellation and the timeout race. The transport classifies it internally as `caller` or `timeout`, allowing Phase 3.3 to produce the correct public error without relying on runtime-specific Fetch error messages. Timers and caller-signal listeners are removed in `finally` for success, parsing failure, cancellation, timeout, and network failure. An injected Fetch implementation is required to follow the Fetch contract and observe the supplied signal.

## D016 — Public error hierarchy and defensive mapping

- Status: accepted
- Date: 2026-09-12
- Decision: expose stable SDK errors without depending on undocumented SendLib response bodies

All SDK-produced errors extend `SendlibError`. Local configuration and input failures use `SendlibConfigError` and `SendlibValidationError`; HTTP failures use `SendlibApiError` and status-specific subclasses for `401`, `403`, `413`, and `429`; request timeouts, caller cancellation, and network failures use `SendlibTimeoutError`, `SendlibAbortError`, and `SendlibNetworkError` respectively. Batch-endpoint `403` responses use the previously approved `SendlibPlanRequiredError` subtype with stable `feature: 'batch'` and `requiredPlan: 'pro'` literals.

Default messages are SDK-authored and never depend on an upstream body. The complete parsed JSON, text, malformed text, or empty response is retained as `body: unknown`. String `message` and `code` fields and `x-request-id` are exposed only as optional observations, never required contract fields. Raw bodies and observed upstream strings are non-enumerable so routine error serialization does not emit them. `retryAfterMs` is populated from a valid `Retry-After` header.

Standard `cause` is supported throughout. Transport-specific abort details remain internal and are converted into the public timeout or cancellation class before leaving the shared request function.

## D017 — Error redaction boundary

- Status: accepted
- Date: 2026-09-12
- Decision: errors expose useful response metadata without retaining request credentials or content

The transport never copies request headers, API keys, request bodies, attachment data, or recipient lists into public errors. Default messages are fixed SDK text. A Fetch failure is wrapped with a generic sanitized cause instead of retaining an injected implementation's arbitrary error message, because that message may contain credentials or message content.

HTTP errors may retain the parsed upstream response as non-enumerable `body: unknown`, plus non-enumerable observed string `code` and `message` fields. This is an intentional response-diagnostics escape hatch, not request metadata, and routine JSON serialization omits it. Only the response `x-request-id` and parsed `Retry-After` are copied into enumerable diagnostics. Batch `403` responses always use the same safe plan-required message regardless of whether the upstream body is JSON, text, malformed, or empty.

## D018 — Retry safety and backoff

- Status: accepted
- Date: 2026-09-12
- Decision: retry only safe GET operations; never retry a POST automatically

The shared transport applies bounded retries only to GET requests after a network error, `429`, or status `500`, `502`, `503`, or `504`. `POST /api/send` and `POST /api/batch` are never retried because SendLib documents no idempotency mechanism and an ambiguous failure could otherwise duplicate mail.

`maxRetries` counts attempts after the initial request. A valid `Retry-After` delta-seconds or IMF-fixdate value takes precedence for `429`; otherwise the SDK uses full jitter from zero through an exponential window beginning at 250 milliseconds and capped at 10 seconds. Invalid and past header values are handled defensively. Retry sleeps observe the caller's abort signal, and injectable sleep/random dependencies keep limits and timing deterministic in unit tests.

## D019 — Single-email client and template namespaces

- Status: accepted
- Date: 2026-09-13
- Decision: expose one `Sendlib` client with email, template, and deliverability namespaces

`new Sendlib(options)` validates and snapshots configuration, then exposes frozen `emails`, `templates`, and `deliverability` resources. `emails.send` is the sole implementation of `POST /api/send`; template methods delegate to it so validation, transport, error mapping, cancellation, and future fixes cannot diverge. There is no default export.

The endpoint builder forwards only documented fields and does not mutate, render, decode, encode, or otherwise transform caller content. The lower-level discriminated template form remains accepted by `emails.send`. `templates.send` accepts any dashboard slug, while nine camelCase convenience methods map to the documented starter slugs. Their `TemplateSendInput` intentionally keeps `data` open-ended because dashboard edits can change variables.

Constructor failures become `SendlibConfigError`; email and call-option failures become `SendlibValidationError`, retaining the validator error as `cause`. Upstream `400` responses remain `SendlibApiError` with non-enumerable raw details because SendLib does not publish a stable validation-body schema.

Live custom and template tests require an explicit `SENDLIB_RUN_INTEGRATION_TESTS=true` gate and maintainer-controlled environment values. They are skipped by default and were not executed during local Phase 4 verification because no live credentials or approved recipient were supplied.

## D020 — Pro batch resources and bounded polling

- Status: accepted
- Date: 2026-09-13
- Decision: expose Pro batch creation, retrieval, and bounded status polling under `sendlib.batches`

`batches.create` sends one allow-listed `POST /api/batch` payload and is never automatically retried. It makes no account-plan preflight request; any batch-endpoint `403` becomes the stable `SendlibPlanRequiredError`. `batches.retrieve` URL-encodes the caller's non-empty ID and uses the shared safe-GET retry policy.

`batches.wait` always has a finite overall timeout and a positive interval. It composes that deadline with caller cancellation and passes the combined signal through active GET attempts, retry delays, and polling delays. Consequently, internal retries cannot extend the operation beyond its overall deadline, and polling never creates another batch.

The documented states have explicit behavior: `queued` and `processing` continue polling; `done` returns; `failed` throws `SendlibBatchFailedError`; and `paused_limit_reached` returns by default because SendLib may wait until Gmail quota resets. Callers may set `returnOnPausedLimit: false` to keep waiting within the same finite deadline. `SendlibBatchWaitTimeoutError` distinguishes an overall polling deadline from an individual HTTP attempt timeout. A failed batch response remains available as non-enumerable diagnostics so routine serialization does not expose recipient data.

The real Pro flow has a separate `SENDLIB_RUN_BATCH_INTEGRATION_TESTS=true` gate in addition to the general integration-test gate. It creates one tiny approved batch and polls only the returned ID. It was not executed locally because no Pro credential and approved recipient were supplied.

## D021 — Homepage documentation, examples, and governance

- Status: accepted
- Date: 2026-09-13
- Decision: make the root README the complete user guide and make every executable example fail closed

The root README is both the GitHub homepage and npm landing page. It therefore covers compatibility, installation, SendLib/Gmail/key setup, environment ownership, every email/template/batch workflow, configuration, errors, retry and cancellation behavior, deliverability guidance, documented quotas, security, support, and maintenance policy. A single Mermaid flowchart is used for the batch polling state transitions because the relationship between creation, repeated retrieval, terminal states, pause, cancellation, and deadline is clearer visually.

Repository examples use environment-provided credentials and placeholder recipients only. Each checks `SENDLIB_RUN_EXAMPLE=true` before reading credentials or constructing a client. The CI script compiles them and launches each example with opt-in explicitly disabled, requiring a failure at the safety guard. Live integration tests retain their separate gates and are not substituted for documentation examples.

The repository adopts contribution, conduct, support, security, issue-triage, contract-drift, deprecation, and pull-request policies. Security reports have private GitHub and direct-email routes. Because there is currently one maintainer, no CODEOWNERS file is added; an ownership rule without multiple reviewers would provide no useful routing and could imply governance that does not exist.

## Community branding policy

- Use “SendLib” only to identify API compatibility.
- Describe the package as unofficial and community-maintained at prominent discovery points.
- Describe the SDK as an independent community project rather than claiming that no SendLib-affiliated person has contributed.
- Credit individual contributors accurately, including contributors affiliated with SendLib, without turning individual participation into a claim of official sponsorship, endorsement, maintenance, or support.
- Do not use SendLib logos, copied visual identity, or wording that implies an official relationship without written permission.
- Keep SDK support separate from SendLib service/account support.
- If SendLib publishes trademark or community-integration guidance later, review the package against it and make any necessary changes.
