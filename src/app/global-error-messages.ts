import type { Locale } from '@/i18n/locales';

/**
 * global-error.tsx が使う文言（ロゴと誤りの画面）。global-error はどのページにも読み込まれるので、
 * messages/*.json を丸ごと入れると、全ページに文言の全部（約 40KB）が載る。
 * そこで英語だけをここに写して持ち、日本語は誤りが出たときに読みに行く。
 * 写しが en.json とずれたら test/messages.test.ts が落ちる
 */
export const ENGLISH = {
  metadata: { title: 'Jumps Lab' },
  errorPage: {
    title: 'Something went wrong',
    body: "This screen couldn't be shown. Try again, and go back to Home if it keeps happening.",
    offlineTitle: "Can't connect",
    offlineBody: 'Check your connection and try again.',
    retry: 'Try again',
    home: 'Go to Home',
    code: 'Error ID: {digest}',
    notFoundTitle: 'Page not found',
    notFoundBody: "This page doesn't exist, or the record was deleted.",
  },
};

/** その言語の文言を読む。読めなければ（電波が無いなど）英語 */
export async function loadMessages(locale: Locale): Promise<typeof ENGLISH> {
  if (locale === 'en') return ENGLISH;
  try {
    const all = (await import('../../messages/ja.json')).default;
    return { metadata: { title: all.metadata.title }, errorPage: all.errorPage };
  } catch {
    return ENGLISH;
  }
}
