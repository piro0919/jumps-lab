import { getTranslations } from 'next-intl/server';
import { GoogleButton } from './google-button';

export default async function SignIn() {
  const t = await getTranslations('metadata');

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col items-center justify-center gap-10 px-6">
      <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
      <GoogleButton />
    </main>
  );
}
