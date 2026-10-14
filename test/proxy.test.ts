import { NextRequest } from 'next/server';
import { describe, expect, it } from 'vitest';
import { proxy } from '@/proxy';

/**
 * ログインしていない人を通すページ（src/proxy.ts）。保護者の同意の画面は、鍵の付いた1段だけを通す
 */
const open = (path: string) => proxy(new NextRequest(new URL(path, 'http://localhost:3110')));

/** ログインの画面へ送られたか */
const toSignIn = (response: Response) =>
  response.headers.get('location') === 'http://localhost:3110/sign-in';

describe('proxy（ログインしていない人）', () => {
  it('保護者の同意の画面は、ログインせずに開ける', () => {
    expect(toSignIn(open('/guardian-consent/AbC_12-xyz'))).toBe(false);
  });

  it('鍵の無いもの・下の段・ほかの文字の混じるものは通さない', () => {
    expect(toSignIn(open('/guardian-consent'))).toBe(true);
    expect(toSignIn(open('/guardian-consent/'))).toBe(true);
    expect(toSignIn(open('/guardian-consent/abc/def'))).toBe(true);
    expect(toSignIn(open('/guardian-consent/abc.def'))).toBe(true);
  });

  it('チームの招待の画面は、ログインの画面へ送り、ログインのあとに戻す（?next=）', () => {
    expect(open('/join/AbC_12-xyz').headers.get('location')).toBe(
      'http://localhost:3110/sign-in?next=%2Fjoin%2FAbC_12-xyz',
    );
    // 招待の形でない道は、戻り先を付けずに送る
    expect(toSignIn(open('/join/abc/def'))).toBe(true);
    expect(toSignIn(open('/teams'))).toBe(true);
  });

  it('アプリの中はログインの画面へ送る', () => {
    expect(toSignIn(open('/log/today/menu/new'))).toBe(true);
  });
});
