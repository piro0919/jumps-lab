import type { ErrorEvent } from '@sentry/nextjs';
import { describe, expect, it } from 'vitest';
import { scrubEvent } from '@/lib/scrub-event';

/**
 * プライバシーポリシー（/privacy の5）で「送るのは不具合の内容とページのアドレスだけ。記録・プロフィール・
 * IP アドレス・クッキーは送らない」と約束している。その約束を守るのが scrubEvent
 */
describe('scrubEvent', () => {
  it('利用者・本文・クッキー・ヘッダー・問い合わせの文字列・足跡を落とし、アドレスだけ残す', () => {
    const event = scrubEvent({
      type: undefined,
      user: { id: 'u1', ip_address: '203.0.113.1', email: 'a@example.com' },
      request: {
        url: 'https://jumpslab.kkweb.io/api/auth/callback/google?code=secret&state=x',
        cookies: { 'better-auth.session_token': 'secret' },
        data: { mark: '6.12', note: 'ひざが痛い' },
        headers: { 'x-forwarded-for': '203.0.113.1' },
        query_string: 'code=secret',
      },
      contexts: { nextjs: { request_path: '/log/2026-10-11?add=1' } },
      breadcrumbs: [
        { category: 'console', message: 'Failing row contains (6.12, ひざが痛い)' },
        { data: { url: 'https://api.open-meteo.com/v1/forecast?latitude=35.68' } },
      ],
    } as ErrorEvent);

    expect(event.user).toBeUndefined();
    expect(event.request).toEqual({ url: 'https://jumpslab.kkweb.io/api/auth/callback/google' });
    expect(event.contexts?.nextjs?.request_path).toBe('/log/2026-10-11');
    expect(event.breadcrumbs).toBeUndefined();
  });
});
