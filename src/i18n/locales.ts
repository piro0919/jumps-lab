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

/**
 * 言語を決める順。本人が設定で選んだ言語（Cookie）、ブラウザの言語、英語。
 * 画面（src/i18n/request.ts）と通知の受け口（src/app/api/push）が同じ順で決めるために共有する
 */
export function chooseLocale(chosen: string | undefined, acceptLanguage: string | null): Locale {
  return isLocale(chosen) ? chosen : localeFromAcceptLanguage(acceptLanguage);
}

/**
 * 要求の言語。通知の受け口（src/app/api/push）が、宛先に残す言語を決めるのに使う。
 * 画面は Cookie を cookies() から読む: 要求の Cookie ヘッダーには、同じ要求の Server Action が
 * 書いた Cookie が載らず、言語を切り替えた直後の描画が前の言語のままになる（e2e が 2026-10-14 に捕まえた）
 */
export function localeOfRequest(headers: Headers): Locale {
  const chosen = (headers.get('cookie') ?? '')
    .split(';')
    .map((part) => part.trim().split('='))
    .find(([name]) => name === LOCALE_COOKIE)?.[1];
  return chooseLocale(chosen, headers.get('accept-language'));
}
