import { describe, expect, it } from 'vitest';
import { inJapan, JAAF_ENTRY_URL, PREFECTURE_LINKS } from '@/lib/japan';

describe('inJapan', () => {
  it('日本の時間帯の人だけ', () => {
    expect(inJapan('Asia/Tokyo')).toBe(true);
    expect(inJapan('Asia/Seoul')).toBe(false);
    expect(inJapan('UTC')).toBe(false);
  });
});

describe('PREFECTURE_LINKS', () => {
  it('47都道府県が1つずつある', () => {
    expect(PREFECTURE_LINKS).toHaveLength(47);
    expect(new Set(PREFECTURE_LINKS.map((p) => p.ja)).size).toBe(47);
    expect(new Set(PREFECTURE_LINKS.map((p) => p.en)).size).toBe(47);
  });

  // 一覧のリンクとして開くので、http と https のアドレスだけ
  it('すべて http か https のアドレス', () => {
    for (const { url } of [...PREFECTURE_LINKS, { url: JAAF_ENTRY_URL }]) {
      expect(['http:', 'https:']).toContain(new URL(url).protocol);
    }
  });
});
