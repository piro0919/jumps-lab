import { cookies, headers } from 'next/headers';
import { getRequestConfig } from 'next-intl/server';
import { isLocale, LOCALE_COOKIE, localeFromAcceptLanguage } from './locales';

/**
 * 画面の言語と、その言語の文言。言語を URL に含めない（ログインの中のアプリなので、spatto と同じ）。
 * 本人が設定の画面で選んだ言語（Cookie）を先に見て、無ければブラウザの Accept-Language で決める。
 * 選んだ言語はこのブラウザに残す（テーマと同じく端末ごと。ログイン前の画面でも DB を起こさずに効く）
 */
export default getRequestConfig(async () => {
  const chosen = (await cookies()).get(LOCALE_COOKIE)?.value;
  const locale = isLocale(chosen)
    ? chosen
    : localeFromAcceptLanguage((await headers()).get('accept-language'));

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
