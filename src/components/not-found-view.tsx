import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { ErrorScreen } from '@/components/error-screen';
import { buttonVariants } from '@/components/ui/button';

/** 見つからない画面の中身（app/not-found.tsx と app/(app)/not-found.tsx）。ホームへ戻るボタンだけを出す */
export async function NotFoundView({ frame }: { frame: 'app' | 'bare' }) {
  const t = await getTranslations('errorPage');
  const tMeta = await getTranslations('metadata');

  return (
    <ErrorScreen
      frame={frame}
      brand={tMeta('title')}
      title={t('notFoundTitle')}
      body={t('notFoundBody')}
      actions={
        <Link href="/" className={buttonVariants()}>
          {t('home')}
        </Link>
      }
    />
  );
}
