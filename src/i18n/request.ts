import { headers } from 'next/headers';
import { getRequestConfig } from 'next-intl/server';
import { localeFromAcceptLanguage } from './locales';

/**
 * 画面の言語と、その言語の文言。言語を URL に含めない（ログインの中のアプリなので、spatto と同じ）。
 * いまはブラウザの Accept-Language だけで決める。本人が設定で選べるようにしたら、その値を先に見る
 */
export default getRequestConfig(async () => {
  const locale = localeFromAcceptLanguage((await headers()).get('accept-language'));

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
