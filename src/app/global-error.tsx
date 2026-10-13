'use client';

import { NextIntlClientProvider } from 'next-intl';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { ErrorView } from '@/components/error-view';
import { isLocale, type Locale, LOCALE_COOKIE, localeFromAcceptLanguage } from '@/i18n/locales';
import { FONT_VARIABLES } from './fonts';
import { ENGLISH, loadMessages } from './global-error-messages';
import './globals.css';

/** next-themes が選んだ配色を入れておく場所（components/theme-provider.tsx の既定） */
const THEME_KEY = 'theme';

const never = () => () => {};

/** 外枠と同じ順で言語を決める: 設定で選んだ言語の Cookie、無ければブラウザの言語 */
function browserLocale() {
  const chosen = document.cookie
    .split('; ')
    .find((part) => part.startsWith(`${LOCALE_COOKIE}=`))
    ?.slice(LOCALE_COOKIE.length + 1);
  return isLocale(chosen) ? chosen : localeFromAcceptLanguage(navigator.languages.join(','));
}

/** 選んだ配色。端末に合わせるときと、読めないとき（保存を止めたブラウザ）は端末の設定 */
function browserTheme() {
  let saved: string | null = null;
  try {
    saved = localStorage.getItem(THEME_KEY);
  } catch {
    saved = null;
  }
  if (saved === 'light' || saved === 'dark') return saved;
  return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/**
 * 外枠（app/layout.tsx）ごと描けなかったとき。外枠の html・body・文言・配色が無いので、ここで持つ。
 * 言語と配色はブラウザで決め、サーバーで描くときは英語の明るい配色にする。
 * 英語のまま描いておき、ほかの言語は文言が届いてから差し替える（届かなければ英語のまま）
 */
export default function GlobalError(props: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  const locale = useSyncExternalStore(never, browserLocale, () => 'en' as const);
  const theme = useSyncExternalStore(never, browserTheme, () => 'light' as const);
  const [loaded, setLoaded] = useState<{ locale: Locale; messages: typeof ENGLISH } | null>(null);

  useEffect(() => {
    if (locale === 'en') return;
    let live = true;
    void loadMessages(locale).then((messages) => {
      if (live) setLoaded({ locale, messages });
    });
    return () => {
      live = false;
    };
  }, [locale]);

  const shown = loaded?.locale === locale ? loaded : { locale: 'en' as const, messages: ENGLISH };

  return (
    <html lang={shown.locale} data-theme={theme} className={`${FONT_VARIABLES} h-full antialiased`}>
      <body className="min-h-full min-w-page font-sans">
        <NextIntlClientProvider locale={shown.locale} messages={shown.messages}>
          <ErrorView {...props} frame="bare" />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
