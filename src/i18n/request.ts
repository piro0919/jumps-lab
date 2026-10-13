import { headers } from 'next/headers';
import { getRequestConfig } from 'next-intl/server';
import { isLocale, localeOfRequest, PAGE_LOCALE_HEADER } from './locales';

/**
 * 画面の言語と、その言語の文言。言語を URL に含めない（ログインの中のアプリなので、spatto と同じ）。
 * 本人が設定の画面で選んだ言語（Cookie）を先に見て、無ければブラウザの Accept-Language で決める。
 * 選んだ言語はこのブラウザに残す（テーマと同じく端末ごと。ログイン前の画面でも DB を起こさずに効く）。
 * LP（/ と /ja）だけは URL で言語が決まり、src/proxy.ts が付けたヘッダーを先に見る
 */
export default getRequestConfig(async () => {
  const requestHeaders = await headers();
  const page = requestHeaders.get(PAGE_LOCALE_HEADER);
  // Cookie と Accept-Language の順は、通知の宛先に残す言語（src/app/api/push）と同じ関数で決める
  const locale = isLocale(page) ? page : localeOfRequest(requestHeaders);

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
