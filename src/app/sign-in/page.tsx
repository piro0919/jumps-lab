import Link from 'next/link';
import { getLocale, getTranslations } from 'next-intl/server';
import { GoogleButton } from './google-button';

export default async function SignIn() {
  const t = await getTranslations('metadata');
  const tSignIn = await getTranslations('signIn');
  // 規約は日本語が /terms、英語が /en/terms
  const prefix = (await getLocale()) === 'ja' ? '' : '/en';

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col items-center justify-center gap-10 px-6">
      <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
      <div className="flex w-full flex-col gap-4">
        <GoogleButton />
        {/* 同意は押すボタンの下に一文で（押す動作の名前に合わせる。spatto と同じ） */}
        <p className="text-center text-xs leading-relaxed text-sub">
          {tSignIn.rich('consent', {
            terms: (chunks) => (
              <Link href={`${prefix}/terms`} className="text-accent underline">
                {chunks}
              </Link>
            ),
            privacy: (chunks) => (
              <Link href={`${prefix}/privacy`} className="text-accent underline">
                {chunks}
              </Link>
            ),
          })}
        </p>
      </div>
    </main>
  );
}
