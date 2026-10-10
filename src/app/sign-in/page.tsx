import { getSessionCookie } from 'better-auth/cookies';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { AppIcon, Wordmark } from '@/components/layout-ui';
import { getAuth } from '@/lib/auth';
import { Consent } from './consent';
import { GoogleButton } from './google-button';

export default async function SignIn() {
  // 印のある人だけ、セッションが生きているかを確かめてトップへ送る（印の無い人のために DB を起こさない）
  const requestHeaders = await headers();
  if (
    getSessionCookie(requestHeaders) &&
    (await getAuth().api.getSession({ headers: requestHeaders }))
  ) {
    redirect('/');
  }
  const t = await getTranslations('metadata');

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col items-center justify-center gap-10 px-6">
      <div className="flex flex-col items-center gap-4">
        <AppIcon size="hero" />
        <h1>
          <Wordmark size="hero">{t('title')}</Wordmark>
        </h1>
      </div>
      <div className="flex w-full flex-col gap-4">
        <GoogleButton />
        <div className="text-center">
          <Consent />
        </div>
      </div>
    </main>
  );
}
