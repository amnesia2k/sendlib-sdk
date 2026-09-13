/** Authentication header strategy used for SendLib API requests. */
export type SendlibAuthMode = 'bearer' | 'x-api-key';

/**
 * A Fetch API-compatible transport.
 *
 * Supplying this is useful for tests, proxies, tracing, or applications that
 * already wrap Node's global `fetch`. Browser usage remains unsupported because
 * a SendLib API key must never be exposed to client-side code.
 */
export type SendlibFetch = typeof globalThis.fetch;

/** Configuration accepted by the SendLib client. */
export interface SendlibOptions {
  /** SendLib API key. Keep this value server-side and never log it. */
  readonly apiKey: string;

  /**
   * Override the SendLib API origin.
   *
   * @defaultValue `https://sendlib.samueltuoyo.com`
   */
  readonly baseUrl?: string;

  /**
   * Authentication header strategy.
   *
   * @defaultValue `'bearer'`
   */
  readonly authMode?: SendlibAuthMode;

  /**
   * Maximum duration of one HTTP attempt in milliseconds.
   *
   * @defaultValue `30000`
   */
  readonly timeoutMs?: number;

  /**
   * Maximum retry count for operations the SDK has classified as safe to
   * retry. This option never makes ambiguous email-creating POST requests
   * retryable.
   *
   * @defaultValue `2`
   */
  readonly maxRetries?: number;

  /** Fetch-compatible transport. Defaults to Node's global `fetch`. */
  readonly fetch?: SendlibFetch;
}

/** Per-request controls accepted by endpoint methods. */
export interface SendlibCallOptions {
  /** Cancels this request without affecting the client or other requests. */
  readonly signal?: AbortSignal;

  /**
   * Override the client's per-attempt timeout for this request in milliseconds.
   * A value of `0` requests an immediate timeout.
   */
  readonly timeoutMs?: number;
}

/**
 * An email address accepted by SendLib.
 *
 * This is intentionally a plain string. TypeScript cannot prove that a string
 * is a deliverable email address, and SendLib remains authoritative for address
 * validation.
 */
export type EmailAddress = string;

/** One email address or a readonly list of email addresses. */
export type EmailRecipient = EmailAddress | readonly EmailAddress[];

/** A base64-encoded file attachment for a custom-content email. */
export interface Attachment {
  /** Filename presented to the recipient. */
  readonly filename: string;
  /** Base64-encoded file content, without SDK decoding or re-encoding. */
  readonly content: string;
  /** Optional MIME content type, for example `application/pdf`. */
  readonly type?: string;
}

/** Template placeholder values forwarded to SendLib unchanged. */
export type TemplateData = Readonly<Record<string, unknown>>;

/**
 * A SendLib email containing caller-provided content.
 *
 * The documented v1 contract requires HTML. `text` is an optional plain-text
 * fallback; text-only sends are not exposed until SendLib documents them.
 */
export interface CustomEmailInput {
  /** Optional connected Gmail sender; required upstream when several are connected. */
  readonly from?: EmailAddress;
  /** Primary recipient or recipients. SendLib documents a maximum of 50. */
  readonly to: EmailRecipient;
  /** Email subject. SendLib documents a maximum of 998 characters. */
  readonly subject: string;
  /** Required HTML body for the documented custom-content mode. */
  readonly html: string;
  /** Optional plain-text fallback body. */
  readonly text?: string;
  /** Optional Reply-To email address. */
  readonly replyTo?: EmailAddress;
  /** Optional CC recipient or recipients. SendLib documents a maximum of 50. */
  readonly cc?: EmailRecipient;
  /** Optional BCC recipient or recipients. SendLib documents a maximum of 50. */
  readonly bcc?: EmailRecipient;
  /** Optional readonly list of base64-encoded attachments. */
  readonly attachments?: readonly Attachment[];
  /** Template mode cannot be combined with custom content. */
  readonly template?: never;
  /** Template data cannot be combined with custom content. */
  readonly data?: never;
}

/**
 * A SendLib email rendered from a dashboard template.
 *
 * The public contract only documents one `to` address and optional `from` for
 * this mode. Custom bodies, overrides, additional recipient fields, and
 * attachments are deliberately excluded until SendLib verifies support.
 */
export interface TemplateEmailInput {
  /** Optional connected Gmail sender; required upstream when several are connected. */
  readonly from?: EmailAddress;
  /** The single recipient documented for template sends. */
  readonly to: EmailAddress;
  /** Dashboard template slug. */
  readonly template: string;
  /** Placeholder values forwarded without coercion. */
  readonly data: TemplateData;
  readonly subject?: never;
  readonly html?: never;
  readonly text?: never;
  readonly replyTo?: never;
  readonly cc?: never;
  readonly bcc?: never;
  readonly attachments?: never;
}

/**
 * Input accepted by methods on `sendlib.templates`.
 *
 * The selected method supplies the template slug, so callers only provide the
 * documented recipient, optional sender, and dashboard interpolation data.
 */
export interface TemplateSendInput {
  /** Optional connected Gmail sender; required upstream when several are connected. */
  readonly from?: EmailAddress;
  /** The single recipient documented for template sends. */
  readonly to: EmailAddress;
  /** Placeholder values forwarded without coercion. */
  readonly data: TemplateData;
}

/**
 * Input accepted by the immediate-send endpoint.
 *
 * The presence of `template` structurally discriminates template sends from
 * custom-content sends, while `never` properties reject mixed modes.
 */
export type SendEmailInput = CustomEmailInput | TemplateEmailInput;

/** Per-recipient placeholder values forwarded to SendLib unchanged. */
export type BatchVariables = Readonly<Record<string, unknown>>;

/** One recipient in a batch-send request. */
export interface BatchRecipient {
  /** Recipient email address. */
  readonly email: EmailAddress;
  /** Optional values used to interpolate this recipient's content. */
  readonly variables?: BatchVariables;
}

interface CreateBatchBaseInput {
  /** Connected Gmail sender. Display-name format is supported upstream. */
  readonly from: EmailAddress;
  /** Batch subject; may contain SendLib template variables. */
  readonly subject: string;
  /** Non-empty recipient list. Limits depend on the connected Gmail account. */
  readonly recipients: readonly BatchRecipient[];
  /** Optional Reply-To email address. */
  readonly replyTo?: EmailAddress;
  /** Batch sending does not support attachments. */
  readonly attachments?: never;
}

interface BatchHtmlContent {
  /** HTML batch body. */
  readonly html: string;
  /** Optional plain-text fallback. */
  readonly text?: string;
}

interface BatchTextContent {
  /** Optional HTML alternative. */
  readonly html?: string;
  /** Plain-text batch body. */
  readonly text: string;
}

/**
 * Input accepted by the Pro-only batch creation endpoint.
 *
 * At least one of `html` or `text` is required. Attachments are rejected by
 * this type because SendLib does not support them for batch sends.
 */
export type CreateBatchInput = CreateBatchBaseInput & (BatchHtmlContent | BatchTextContent);

/** Documented aggregate states for a SendLib batch job. */
export type BatchStatus = 'queued' | 'processing' | 'paused_limit_reached' | 'done' | 'failed';

/** Recipient states demonstrated by the public batch-status example. */
export type KnownBatchRecipientStatus = 'pending' | 'sent';

/**
 * Status of one batch recipient.
 *
 * SendLib only demonstrates `pending` and `sent`, but does not publish an
 * exhaustive list. The string intersection retains autocomplete for known
 * values without rejecting a future server-provided status.
 */
export type BatchRecipientStatus = KnownBatchRecipientStatus | (string & Record<never, never>);

/** Response documented for a successfully queued batch. */
export interface CreateBatchResponse {
  readonly success: true;
  readonly batchId: string;
  readonly total: number;
  readonly status: 'queued';
}

/** Per-recipient delivery information in a batch-status response. */
export interface BatchRecipientResult {
  readonly email: EmailAddress;
  readonly status: BatchRecipientStatus;
  readonly messageId: string | null;
  /** `null` is demonstrated; the shape of a non-null error is not documented. */
  readonly error: unknown;
}

/** Response documented for retrieving the current state of a batch. */
export interface BatchStatusResponse {
  readonly success: true;
  readonly batchId: string;
  readonly status: BatchStatus;
  readonly total: number;
  readonly sent: number;
  readonly failed: number;
  readonly progress: number;
  readonly recipients: readonly BatchRecipientResult[];
}

/** Options for bounded polling performed by the SDK's batch wait helper. */
export interface WaitForBatchOptions {
  /** Positive delay between status requests in milliseconds. @defaultValue `1000` */
  readonly intervalMs?: number;
  /** Finite, nonnegative maximum total polling duration in milliseconds. @defaultValue `60000` */
  readonly timeoutMs?: number;
  /** Cancels polling and any active status request. */
  readonly signal?: AbortSignal;
  /**
   * Return when Gmail's daily limit pauses the batch instead of continuing to
   * poll until the overall timeout.
   *
   * @defaultValue `true`
   */
  readonly returnOnPausedLimit?: boolean;
}

/**
 * Debug information optionally returned by SendLib after an immediate send.
 *
 * SendLib documents the existence of `issues`, but not the JSON structure of
 * each entry or the remaining debug fields. Unknown values are intentionally
 * preserved so callers can inspect them with application-specific narrowing.
 */
export interface SendEmailDebug {
  /** Undocumented issue entries returned by SendLib's email debugger. */
  readonly issues?: readonly unknown[];
  /** Additional current or future SendLib debug information. */
  readonly [key: string]: unknown;
}

/**
 * Successful response from the immediate-send endpoint.
 *
 * The public documentation does not publish a complete custom or template
 * success fixture. Consequently, this type guarantees no success flag, message
 * ID, or other undocumented field. It only types the optional documented debug
 * container and preserves every other field as `unknown`.
 */
export interface SendEmailResponse {
  readonly debug?: SendEmailDebug;
  readonly [key: string]: unknown;
}
