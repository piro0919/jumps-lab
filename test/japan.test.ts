import { describe, expect, it } from 'vitest';
import { inJapan, JAAF_ENTRY_URL, PREFECTURE_LINKS, SCHEDULE_YEAR } from '@/lib/japan';

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

describe('年度入りのリンク', () => {
  // 年度が替わったら SCHEDULE_YEAR を上げ、ここで落ちたリンクを新年度の URL に差し替える
  it('年度入りの URL は一覧の年度を含む（4桁か下2桁）', () => {
    const short = String(SCHEDULE_YEAR % 100);
    for (const { ja, url, yearly } of PREFECTURE_LINKS) {
      if (!yearly) continue;
      expect(url.includes(String(SCHEDULE_YEAR)) || url.includes(short), ja).toBe(true);
    }
  });
});
