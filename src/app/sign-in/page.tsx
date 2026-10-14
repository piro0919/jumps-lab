import { getSessionCookie } from 'better-auth/cookies';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { AppIcon, Wordmark } from '@/components/layout-ui';
import { getAuth } from '@/lib/auth';
import { joinReturnPath } from '@/lib/safe-next';
import { Consent } from './consent';
import { GoogleButton } from './google-button';

/**
 * ログインの画面。?next= があれば、ログインのあとにそこへ戻す。戻すのはチームの招待の画面（/join/<鍵>）だけで、
 * ほかの値は捨てる（src/lib/safe-next.ts。外のサイトへ送り出す道にしない）
 */
export default async function SignIn({ searchParams }: PageProps<'/sign-in'>) {
  const { next } = await searchParams;
  const back = joinReturnPath(typeof next === 'string' ? next : null);
  // 印のある人だけ、セッションが生きているかを確かめてトップへ送る（印の無い人のために DB を起こさない）
  const requestHeaders = await headers();
  if (
    getSessionCookie(requestHeaders) &&
    (await getAuth().api.getSession({ headers: requestHeaders }))
  ) {
    redirect(back ?? '/');
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
        <GoogleButton callbackURL={back ?? '/'} />
        <div className="text-center">
          <Consent />
        </div>
      </div>
    </main>
  );
}
