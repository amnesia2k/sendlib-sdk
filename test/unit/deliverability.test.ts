import { describe, expect, it } from 'vitest';

import { analyzeDeliverability } from '../../src/deliverability.js';

describe('analyzeDeliverability', () => {
  it('passes an inbox-friendly custom email while retaining the manual audience check', () => {
    const report = analyzeDeliverability({
      from: '"Alex at Company" <hello@example.test>',
      to: 'recipient@example.test',
      subject: 'Quick update regarding your connection',
      html: '<p>Hi Alex, your connection can be restored in your dashboard.</p>',
      text: 'Hi Alex, your connection can be restored in your dashboard.',
    });

    expect(report.issues).toEqual([]);
    expect(report.manualChecks).toHaveLength(1);
    expect(report.manualChecks[0]?.code).toBe('expected-recipients');
    expect(typeof report.manualChecks[0]?.message).toBe('string');
    expect(report.passedAutomatedChecks).toBe(true);
    expect(Object.isFrozen(report)).toBe(true);
    expect(Object.isFrozen(report.issues)).toBe(true);
    expect(Object.isFrozen(report.manualChecks)).toBe(true);
  });

  it('counts the same destination in HTML and text as one link', () => {
    const report = analyzeDeliverability({
      to: 'recipient@example.test',
      subject: 'A quick account update',
      html: '<p>See <a href="https://example.test/account">your account</a>.</p>',
      text: 'See your account: https://example.test/account.',
    });

    expect(report.issues).not.toContainEqual(expect.objectContaining({ code: 'multiple-links' }));
  });

  it('reports documented risk signals without including message content', () => {
    const recognizableContent = 'PRIVATE-CONTENT-MARKER';
    const report = analyzeDeliverability({
      from: 'hello@example.test',
      to: 'recipient@example.test',
      subject: `URGENT Action Required ${recognizableContent}`,
      html: [
        '<p>Start your Free Trial and Upgrade now.</p>',
        '<a href="https://one.example.test">One</a>',
        '<a href="https://two.example.test" role="button">Buy Now</a>',
        '<img src="data:image/png;base64,eA==">',
        '<img src="https://images.example.test/two.png">',
      ].join(''),
    });

    expect(report.issues.map(({ code }) => code)).toEqual([
      'sender-display-name-missing',
      'spam-trigger-language',
      'multiple-links',
      'image-heavy-html',
      'button-heavy-html',
      'plain-text-fallback-missing',
    ]);
    expect(report.manualChecks.map(({ code }) => code)).toEqual([
      'expected-recipients',
      'image-size-and-layout',
    ]);
    expect(report.passedAutomatedChecks).toBe(false);
    expect(JSON.stringify(report)).not.toContain(recognizableContent);
    report.issues.forEach((value) => {
      expect(Object.isFrozen(value)).toBe(true);
    });
  });

  it('analyzes plain-text batch links and does not mutate frozen input', () => {
    const input = Object.freeze({
      from: '"Service Team" <service@example.test>',
      subject: 'Weekly usage summary',
      recipients: Object.freeze([Object.freeze({ email: 'recipient@example.test' })]),
      text: 'Review https://one.example.test and https://two.example.test',
    });
    const before = JSON.stringify(input);

    const report = analyzeDeliverability(input);

    expect(report.issues.map(({ code }) => code)).toEqual(['multiple-links']);
    expect(JSON.stringify(input)).toBe(before);
  });

  it('limits template analysis to visible sender data and a rendered-content manual check', () => {
    const report = analyzeDeliverability({
      to: 'recipient@example.test',
      template: 'password-reset',
      data: { name: 'Alex', code: '482921' },
    });

    expect(report.issues).toEqual([]);
    expect(report.manualChecks.map(({ code }) => code)).toEqual([
      'expected-recipients',
      'template-rendered-content',
    ]);
    report.manualChecks.forEach(({ message }) => {
      expect(typeof message).toBe('string');
    });
    expect(report.passedAutomatedChecks).toBe(true);
  });

  it('warns about one embedded image even when the message has a text fallback', () => {
    const report = analyzeDeliverability({
      to: 'recipient@example.test',
      subject: 'Your receipt',
      html: '<img src="data:image/png;base64,eA==" alt="Receipt">',
      text: 'Your receipt is ready.',
    });

    expect(report.issues.map(({ code }) => code)).toEqual(['image-heavy-html']);
  });
});
