'use client';

import { LogOut } from 'lucide-react';
// 線（components/progress.tsx）を出すため、移るのは @bprogress の useRouter で
import { useRouter } from '@bprogress/next/app';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { signOut } from '@/lib/sign-out';

/** 設定の画面のアカウントの区画のログアウト。自分のアイコンのメニューにも同じものがある */
export function SignOutButton() {
  const t = useTranslations('profile');
  const router = useRouter();

  return (
    <Button
      variant="secondary"
      size="sm"
      type="button"
      onClick={async () => {
        await signOut();
        router.replace('/sign-in');
        router.refresh();
      }}
    >
      <LogOut aria-hidden />
      {t('signOut')}
    </Button>
  );
}
