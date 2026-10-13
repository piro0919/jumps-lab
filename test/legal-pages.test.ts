import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * 規約とプライバシーポリシーは、日本語が正文で英語は訳。条と節を1対1にしてあるので、片方を直したらもう片方の同じ条を直す。
 * 改定日も日英で同じにする。中身だけ変わって日付が据え置きになると、変わっていないという嘘が載る
 * （spatto で、請求の挙動を変えて第3条を直したのに日付が前のままだった）
 */
const read = (path: string) => readFileSync(`src/app/(legal)/${path}/page.tsx`, 'utf8');

const docs = {
  termsJa: read('terms'),
  termsEn: read('en/terms'),
  privacyJa: read('privacy'),
  privacyEn: read('en/privacy'),
};

const headings = (source: string) =>
  [...source.matchAll(/<h2[^>]*>([^<]+)<\/h2>/g)].map((m) => m[1]?.trim() ?? '');

/** 見出しの番号（第3条・Article 3・3.）。並びが日英で同じかを見る */
const numbers = (source: string) =>
  headings(source).map((h) =>
    h
      .match(/^(?:第(\d+)条|Article (\d+)|(\d+)\.)/)
      ?.slice(1)
      .find(Boolean),
  );

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const pad = (value: string | number) => String(value).padStart(2, '0');

function updatedIn(source: string): string | null {
  const ja = source.match(/updated="(\d{4})年(\d{1,2})月(\d{1,2})日"/);
  if (ja) return `${ja[1]}-${pad(ja[2] ?? '')}-${pad(ja[3] ?? '')}`;
  const en = source.match(/updated="([A-Z][a-z]+) (\d{1,2}), (\d{4})"/);
  if (!en) return null;
  const month = MONTHS.indexOf(en[1] ?? '') + 1;
  return month === 0 ? null : `${en[3]}-${pad(month)}-${pad(en[2] ?? '')}`;
}

describe('規約とプライバシーポリシー', () => {
  // 見出しの拾い方が壊れて0件どうしになっても揃って見えるので、数の下限を置く
  it('見出しを拾えている', () => {
    for (const [name, source] of Object.entries(docs)) {
      expect(headings(source).length, name).toBeGreaterThanOrEqual(8);
    }
  });

  it.each([
    ['規約', 'termsJa', 'termsEn'],
    ['プライバシーポリシー', 'privacyJa', 'privacyEn'],
  ] as const)('%s の条の番号は日英で同じ並び', (_label, ja, en) => {
    expect(numbers(docs[en])).toEqual(numbers(docs[ja]));
    expect(numbers(docs[ja]).every(Boolean)).toBe(true);
  });

  it.each([
    ['規約', 'termsJa', 'termsEn'],
    ['プライバシーポリシー', 'privacyJa', 'privacyEn'],
  ] as const)('%s の改定日は日英で同じ', (_label, ja, en) => {
    const left = updatedIn(docs[ja]);
    expect(left, '日本語の日付を読めませんでした').not.toBeNull();
    expect(updatedIn(docs[en]), '英語の日付を読めませんでした').toBe(left);
  });
});
