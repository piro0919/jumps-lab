import { describe, expect, it, vi } from 'vitest';

/**
 * 招待の画面（src/app/join/[token]/page.tsx）。Cookie だけ残ってセッションが切れた人は src/proxy.ts を通り抜けるので、
 * 画面がログインの画面へ送るときも ?next= で招待の画面へ戻す（招待を失わない）
 */

const navigation = vi.hoisted(() => ({
  redirect: vi.fn((path: string) => {
    throw new Error(`redirect ${path}`);
  }),
}));
vi.mock('next/navigation', () => navigation);
vi.mock('@/lib/viewer', () => ({
  getViewer: async () => null,
  requireViewer: async () => {
    navigation.redirect('/sign-in');
  },
}));
vi.mock('@/env', () => ({ env: {} }));
vi.mock('@/lib/data', () => ({}));
vi.mock('next-intl/server', () => ({}));
vi.mock('@/components/site-header', () => ({ SiteHeader: () => null }));
vi.mock('@/components/team-join', () => ({ TeamJoinChoice: () => null }));

const { default: Join } = await import('@/app/join/[token]/page');

const open = (token: string) => Join({ params: Promise.resolve({ token }) } as never);

describe('招待の画面', () => {
  it('セッションが無ければ、招待の画面へ戻す ?next= を付けてログインの画面へ', async () => {
    const token = 'abcDEF123_-';
    await expect(open(token)).rejects.toThrow(
      `redirect /sign-in?next=${encodeURIComponent(`/join/${token}`)}`,
    );
  });

  it('鍵の形でなければ、戻り先を付けない', async () => {
    await expect(open('bad token/..')).rejects.toThrow(/^redirect \/sign-in$/);
  });
});
