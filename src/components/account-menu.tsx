'use client';

import { LogOut, Settings } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { authClient } from '@/lib/auth-client';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

/**
 * ヘッダーの右端の、自分のアイコン（Google の顔写真）。押すとメニューが開く（Vercel のアカウントメニューの形）：
 * 上に顔・名前・メール、設定、ログアウト。設定への入口はここだけ（配色は設定の画面で選ぶ）。
 * 写真が無い・読めないときは名前の頭文字を出す
 */
export function AccountMenu({
  name,
  email,
  image,
}: {
  name: string;
  email: string;
  image: string | null;
}) {
  const t = useTranslations('profile');
  const tNav = useTranslations('nav');
  const router = useRouter();

  const avatar = (className?: string) => (
    <Avatar className={className}>
      {image && <AvatarImage src={image} alt="" referrerPolicy="no-referrer" />}
      <AvatarFallback>{name.slice(0, 1).toUpperCase()}</AvatarFallback>
    </Avatar>
  );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={name}
        className="rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        {avatar('size-9')}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <div className="flex items-center gap-3 px-3 py-3">
          {avatar('size-10')}
          <div className="flex min-w-0 flex-col">
            <span className="truncate text-sm font-bold">{name}</span>
            <span className="truncate text-xs text-muted-foreground">{email}</span>
          </div>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => router.push('/settings')}>
          <Settings aria-hidden />
          {tNav('settings')}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={async () => {
            await authClient.signOut();
            router.replace('/sign-in');
            router.refresh();
          }}
        >
          <LogOut aria-hidden />
          {t('signOut')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
