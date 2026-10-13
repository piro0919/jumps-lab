'use client';

import { ErrorView } from '@/components/error-view';

/**
 * ログインの外の画面（LP・規約・ログイン）と、アプリの外枠（ヘッダーごと）が描けなかったとき。
 * 文言は外枠の NextIntlClientProvider から読む
 */
export default function RootError(props: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return <ErrorView {...props} frame="bare" />;
}
