/** 画面の言語。英語を主にし、先頭を既定にする */
const LOCALES = ['en', 'ja'] as const;

export type Locale = (typeof LOCALES)[number];

const DEFAULT_LOCALE: Locale = 'en';

/** 本人が設定で選んだ言語を入れておく Cookie の名前。無ければブラウザの言語で決める */
export const LOCALE_COOKIE = 'locale';

/**
 * 言語が URL で決まるページ（LP の / と /ja）の言語。src/proxy.ts が要求に付け、Cookie とブラウザの言語より先に効く。
 * ブラウザから同じ名前で送られてきたものは src/proxy.ts が外す
 */
export const PAGE_LOCALE_HEADER = 'x-page-locale';

export function isLocale(value: unknown): value is Locale {
  return LOCALES.some((l) => l === value);
}

/**
 * ブラウザの Accept-Language から、持っている言語を選ぶ（spatto の lib/locale.ts と同じ読み方）。
 *
 * 並びの先からではなく、重み（q）の高い順に探す。`en;q=0.8,ja;q=0.9` なら日本語。
 * `en-US` のような地域付きは前半だけ見る。`q=0` は「要らない」なので外す。
 * 持っていない言語しか無ければ既定（英語）
 */
export function localeFromAcceptLanguage(header: string | null): Locale {
  if (!header) return DEFAULT_LOCALE;

  const wanted = header
    .split(',')
    .map((part) => {
      const [tag, q] = part.trim().split(';q=');
      return {
        base: (tag ?? '').trim().toLowerCase().split('-')[0],
        weight: q === undefined ? 1 : Number(q),
      };
    })
    .filter((x) => x.base && Number.isFinite(x.weight) && x.weight > 0)
    .sort((a, b) => b.weight - a.weight);

  for (const { base } of wanted) {
    const hit = LOCALES.find((l) => l === base);
    if (hit) return hit;
  }
  return DEFAULT_LOCALE;
}
