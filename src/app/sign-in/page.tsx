import Link from 'next/link';
import { getLocale, getTranslations } from 'next-intl/server';
import { Wordmark } from '@/components/layout-ui';
import { GoogleButton } from './google-button';

export default async function SignIn() {
  const t = await getTranslations('metadata');
  const tSignIn = await getTranslations('signIn');
  // 規約は日本語が /terms、英語が /en/terms
  const prefix = (await getLocale()) === 'ja' ? '' : '/en';

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col items-center justify-center gap-10 px-6">
      <div className="flex flex-col items-center gap-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icon-192x192.png" alt="" className="size-20 rounded-3xl" />
        <h1>
          <Wordmark size="hero">{t('title')}</Wordmark>
        </h1>
      </div>
      <div className="flex w-full flex-col gap-4">
        <GoogleButton />
        {/* 同意は押すボタンの下に一文で（押す動作の名前に合わせる。spatto と同じ） */}
        <p className="text-center text-xs leading-relaxed text-muted-foreground">
          {tSignIn.rich('consent', {
            terms: (chunks) => (
              <Link href={`${prefix}/terms`} className="text-primary underline">
                {chunks}
              </Link>
            ),
            privacy: (chunks) => (
              <Link href={`${prefix}/privacy`} className="text-primary underline">
                {chunks}
              </Link>
            ),
          })}
        </p>
      </div>
    </main>
  );
}
