import { describe, expect, it } from 'vitest';
import { redactAnalyticsEvent } from '@/components/page-analytics';

/**
 * 閲覧数の集計（Vercel Web Analytics）はページのアドレスを記録する。保護者へのリンクは鍵1つで同意できるので、
 * 鍵を送る前に [token] に替える
 */
describe('redactAnalyticsEvent', () => {
  it('保護者へのリンクの鍵を伏せ、ほかのアドレスはそのまま', () => {
    const token = 'abcDEF123_-xyzABCDEF0123456789abcdefghijklm';
    expect(
      redactAnalyticsEvent({
        type: 'pageview',
        url: `https://jumpslab.kkweb.io/guardian-consent/${token}`,
      }),
    ).toEqual({ type: 'pageview', url: 'https://jumpslab.kkweb.io/guardian-consent/[token]' });
    expect(
      redactAnalyticsEvent({ type: 'pageview', url: 'https://jumpslab.kkweb.io/log/2026-10-14' }),
    ).toEqual({ type: 'pageview', url: 'https://jumpslab.kkweb.io/log/2026-10-14' });
  });
});
