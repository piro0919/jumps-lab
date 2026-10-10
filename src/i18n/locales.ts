/** 画面の言語。英語を主にし、先頭を既定にする */
const LOCALES = ['en', 'ja'] as const;

export type Locale = (typeof LOCALES)[number];

const DEFAULT_LOCALE: Locale = 'en';

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
