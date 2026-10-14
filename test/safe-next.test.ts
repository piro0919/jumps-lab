import { describe, expect, it } from 'vitest';
import { joinReturnPath, safeNext } from '@/lib/safe-next';

/** ログインのあとの戻り先（src/lib/safe-next.ts）。このサイトの外へは出さず、戻すのは招待の画面だけ */
describe('safeNext', () => {
  const origin = (next: string) => new URL(safeNext(next), 'https://jumpslab.kkweb.io').origin;

  it('サイトの中のパスはそのまま', () => {
    expect(safeNext('/log/2026-10-14?add=1#video')).toBe('/log/2026-10-14?add=1#video');
  });

  it.each([
    '//evil.example',
    '/\\evil.example',
    // URL の読み方はタブと改行を捨てるので「//evil.example」になる
    '/\t/evil.example',
    '/\n/evil.example',
    '/\r\n/evil.example',
    'https://evil.example',
    'evil.example',
    'javascript:alert(1)',
  ])('外へ抜ける書き方 %j は / に戻す', (next) => {
    expect(origin(next)).toBe('https://jumpslab.kkweb.io');
    expect(safeNext(next)).toBe('/');
  });

  it('無ければ /', () => {
    expect(safeNext(null)).toBe('/');
    expect(safeNext(undefined)).toBe('/');
  });
});

describe('joinReturnPath', () => {
  it('招待の画面（/join/<鍵>）だけを通す', () => {
    expect(joinReturnPath('/join/AbC_12-xyz')).toBe('/join/AbC_12-xyz');
  });

  it.each([
    '/',
    '/settings',
    '/join',
    '/join/',
    '/join/abc/def',
    '/join/abc?x=1',
    '/join/abc.def',
    '//evil.example/join/abc',
    '/\t/evil.example/join/abc',
    'https://evil.example/join/abc',
    `/join/${'a'.repeat(101)}`,
  ])('ほかの道 %j は null', (next) => {
    expect(joinReturnPath(next)).toBeNull();
  });

  it('無ければ null', () => {
    expect(joinReturnPath(null)).toBeNull();
  });
});
