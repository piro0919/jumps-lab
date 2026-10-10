'use client';

import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { authClient } from '@/lib/auth-client';

export function SignOutButton() {
  const t = useTranslations('profile');
  const [pending, setPending] = useState(false);
  const router = useRouter();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={async () => {
        setPending(true);
        await authClient.signOut();
        router.replace('/sign-in');
        router.refresh();
      }}
      className="mx-4 h-11 rounded-xl bg-surface text-[15px] font-semibold text-danger disabled:opacity-40"
    >
      {t('signOut')}
    </button>
  );
}
