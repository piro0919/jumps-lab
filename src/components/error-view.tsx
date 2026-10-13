'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useSyncExternalStore } from 'react';
import { ErrorScreen } from '@/components/error-screen';
import { Button, buttonVariants } from '@/components/ui/button';

/** 電波が戻った・切れたを聞く */
function subscribeOnline(onChange: () => void) {
  window.addEventListener('online', onChange);
  window.addEventListener('offline', onChange);
  return () => {
    window.removeEventListener('online', onChange);
    window.removeEventListener('offline', onChange);
  };
}

/** 届かなかったときの誤りの文（Chrome・Firefox・Safari と、画面の部品の読み込みの失敗） */
const NETWORK_MESSAGE = /failed to fetch|networkerror|load failed|network|chunk/i;

/**
 * error.tsx と global-error.tsx の中身。電波の問題か、それ以外かで文を分け、もう一度試すボタンとホームへのリンクを出す。
 * 誤りはブラウザから Sentry へ送らない（サーバーの誤りだけを送る、とプライバシーポリシーに書いている）。
 * サーバーの誤りは digest で Sentry の記録と突き合わせられるので、番号だけ小さく出す
 */
export function ErrorView({
  error,
  retry,
  frame,
}: {
  error: Error & { digest?: string };
  retry: () => void;
  frame: 'app' | 'bare';
}) {
  const t = useTranslations('errorPage');
  const tMeta = useTranslations('metadata');
  // サーバーで描くときは電波の有無が分からないので、つながっている側で描く
  const offline = useSyncExternalStore(
    subscribeOnline,
    () => !navigator.onLine,
    () => false,
  );
  const network = offline || NETWORK_MESSAGE.test(`${error.name} ${error.message}`);

  return (
    <ErrorScreen
      frame={frame}
      brand={tMeta('title')}
      title={t(network ? 'offlineTitle' : 'title')}
      body={t(network ? 'offlineBody' : 'body')}
      detail={error.digest ? t('code', { digest: error.digest }) : undefined}
      actions={
        <>
          <Link href="/" className={buttonVariants({ variant: 'secondary' })}>
            {t('home')}
          </Link>
          <Button type="button" onClick={() => retry()}>
            {t('retry')}
          </Button>
        </>
      }
    />
  );
}
