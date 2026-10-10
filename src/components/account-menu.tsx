'use client';

import { LogOut, Settings } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { authClient } from '@/lib/auth-client';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

/**
 * ヘッダーの右端の、自分のアイコン（Google の顔写真）。押すと名前・設定・ログアウトのメニューが開く。
 * スマホではここだけが設定への入口（パソコンはサイドメニューの下にもある）。
 * 写真が無い・読めないときは名前の頭文字を出す
 */
export function AccountMenu({ name, image }: { name: string; image: string | null }) {
  const t = useTranslations('profile');
  const tNav = useTranslations('nav');
  const router = useRouter();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={name}
        className="rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <Avatar>
          {image && <AvatarImage src={image} alt="" referrerPolicy="no-referrer" />}
          <AvatarFallback>{name.slice(0, 1).toUpperCase()}</AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="truncate">{name}</DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => router.push('/settings')}>
          <Settings aria-hidden />
          {tNav('settings')}
        </DropdownMenuItem>
        <DropdownMenuItem
          variant="destructive"
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
