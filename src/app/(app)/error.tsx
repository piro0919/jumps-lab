'use client';

import { ErrorView } from '@/components/error-view';

/**
 * ログインの中の画面が描けなかったとき。ヘッダーとタブは残し、本文の所に出す
 * （外枠の (app)/layout.tsx 自体が落ちたときは、1つ上の app/error.tsx が受ける）
 */
export default function AppError(props: { error: Error & { digest?: string }; retry: () => void }) {
  return <ErrorView {...props} frame="app" />;
}
