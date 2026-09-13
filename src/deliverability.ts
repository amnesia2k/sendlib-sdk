import type { CreateBatchInput, SendEmailInput, TemplateEmailInput } from './types.js';

/** Input supported by the local deliverability analyzer. */
export type DeliverabilityInput = SendEmailInput | CreateBatchInput;

/** Stable, non-sensitive warning categories emitted by the analyzer. */
export type DeliverabilityIssueCode =
  | 'button-heavy-html'
  | 'image-heavy-html'
  | 'multiple-links'
  | 'plain-text-fallback-missing'
  | 'sender-display-name-missing'
  | 'spam-trigger-language';

/** A message field associated with a deliverability warning. */
export type DeliverabilityField = 'content' | 'from' | 'html' | 'text';

/** A local advisory warning. It never contains caller-provided content. */
export interface DeliverabilityIssue {
  readonly code: DeliverabilityIssueCode;
  readonly field: DeliverabilityField;
  readonly message: string;
  readonly severity: 'warning';
}

/** Checks that require application or human knowledge. */
export type DeliverabilityManualCheckCode =
  'expected-recipients' | 'image-size-and-layout' | 'template-rendered-content';

/** A recommendation the SDK cannot determine from the request payload. */
export interface DeliverabilityManualCheck {
  readonly code: DeliverabilityManualCheckCode;
  readonly message: string;
}

/** Non-blocking analysis based on SendLib's published deliverability guidance. */
export interface DeliverabilityReport {
  readonly issues: readonly DeliverabilityIssue[];
  readonly manualChecks: readonly DeliverabilityManualCheck[];
  readonly passedAutomatedChecks: boolean;
}

const SPAM_TRIGGER_PATTERNS = [
  /\baction\s+required\b/iu,
  /\bfree\s+trial\b/iu,
  /\bbuy\s+now\b/iu,
  /\bupgrade\b/iu,
  /\burgent\b/iu,
] as const;

function countMatches(value: string, pattern: RegExp): number {
  return value.match(pattern)?.length ?? 0;
}

function collectLinks(html: string, plainText: string): ReadonlySet<string> {
  const links = new Set<string>();

  for (const match of html.matchAll(/\bhref\s*=\s*["'][^"']+["']/giu)) {
    links.add(match[0].replace(/^\bhref\s*=\s*["']|["']$/giu, ''));
  }

  for (const match of plainText.matchAll(/https?:\/\/[^\s<>"')\]]+/giu)) {
    links.add(match[0].replace(/[.,;:!?]+$/u, ''));
  }

  return links;
}

function issue(
  code: DeliverabilityIssueCode,
  field: DeliverabilityField,
  message: string,
): DeliverabilityIssue {
  return Object.freeze({ code, field, message, severity: 'warning' });
}

function manualCheck(
  code: DeliverabilityManualCheckCode,
  message: string,
): DeliverabilityManualCheck {
  return Object.freeze({ code, message });
}

function isTemplateInput(input: DeliverabilityInput): input is TemplateEmailInput {
  return 'template' in input;
}

/**
 * Analyze an email request using SendLib's published inbox-placement advice.
 *
 * This function is deterministic, does not mutate the input, does not log, and
 * never blocks sending. It uses intentionally conservative heuristics and
 * cannot guarantee inbox placement or determine whether recipients consented.
 */
export function analyzeDeliverability(input: DeliverabilityInput): DeliverabilityReport {
  const issues: DeliverabilityIssue[] = [];
  const manualChecks: DeliverabilityManualCheck[] = [
    manualCheck(
      'expected-recipients',
      'Confirm that every recipient expects this email and that the message is appropriate for them.',
    ),
  ];

  const from = input.from;
  if (from !== undefined && !from.includes('<')) {
    issues.push(
      issue(
        'sender-display-name-missing',
        'from',
        'Consider using the documented display-name sender format for a more recognizable sender.',
      ),
    );
  }

  if (isTemplateInput(input)) {
    manualChecks.push(
      manualCheck(
        'template-rendered-content',
        'Review the rendered dashboard template for light HTML, limited links and images, and neutral language.',
      ),
    );

    return Object.freeze({
      issues: Object.freeze(issues),
      manualChecks: Object.freeze(manualChecks),
      passedAutomatedChecks: issues.length === 0,
    });
  }

  const html = input.html ?? '';
  const text = input.text ?? '';
  const combinedContent = `${input.subject}\n${html}\n${text}`;

  if (SPAM_TRIGGER_PATTERNS.some((pattern) => pattern.test(combinedContent))) {
    issues.push(
      issue(
        'spam-trigger-language',
        'content',
        'Review highly urgent or commercial wording that may resemble spam-trigger language.',
      ),
    );
  }

  if (collectLinks(html, text).size > 1) {
    issues.push(
      issue(
        'multiple-links',
        'content',
        'Consider using no more than one link, especially in a first message to a recipient.',
      ),
    );
  }

  const imageCount = countMatches(html, /<img\b/giu);
  const hasEmbeddedImage = /<img\b[^>]*\bsrc\s*=\s*["']data:image\//iu.test(html);
  if (imageCount > 1 || hasEmbeddedImage) {
    issues.push(
      issue(
        'image-heavy-html',
        'html',
        'Reduce image-heavy or embedded-image HTML to keep the message closer to a personal email.',
      ),
    );
  }
  if (imageCount > 0) {
    manualChecks.push(
      manualCheck(
        'image-size-and-layout',
        'Confirm that images, layout, and visual calls to action remain lightweight and appropriately sized.',
      ),
    );
  }

  if (/<button\b|\brole\s*=\s*["']button["']/iu.test(html)) {
    issues.push(
      issue(
        'button-heavy-html',
        'html',
        'Review prominent buttons and calls to action; a simple text link is usually more inbox-friendly.',
      ),
    );
  }

  if (html.length > 0 && text.length === 0) {
    issues.push(
      issue(
        'plain-text-fallback-missing',
        'text',
        'Consider adding a concise plain-text fallback alongside the HTML body.',
      ),
    );
  }

  return Object.freeze({
    issues: Object.freeze(issues),
    manualChecks: Object.freeze(manualChecks),
    passedAutomatedChecks: issues.length === 0,
  });
}
