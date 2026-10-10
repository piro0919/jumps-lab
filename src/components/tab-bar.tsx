'use client';

import { ChartLine, House, NotebookPen, Plus, Trophy } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { cn } from 'cn';

const TABS = [
  { href: '/', key: 'home', Icon: House },
  { href: '/log', key: 'log', Icon: NotebookPen },
  { href: '/competitions', key: 'competitions', Icon: Trophy },
  { href: '/analysis', key: 'analysis', Icon: ChartLine },
] as const;

/** 今日の記録を足す入口。開いたら追加の窓まで出す */
export const RECORD_HREF = '/log/today?add=1';

function useActive() {
  const pathname = usePathname();
  return (href: string) => (href === '/' ? pathname === '/' : pathname.startsWith(href));
}

/**
 * 幅 1024px 以上の画面の切り替え。ヘッダーの中に横に並べる（手本の Strava の上のメニュー）。
 * 選んでいる画面は字を濃くし、ヘッダーの下端に線を引く
 */
export function HeaderNav() {
  const t = useTranslations('nav');
  const isActive = useActive();

  return (
    <nav className="hidden h-full lg:block">
      <ul className="flex h-full">
        {TABS.map(({ href, key }) => {
          const active = isActive(href);
          return (
            <li key={key} className="h-full">
              <Link
                href={href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex h-full items-center border-b-3 px-4 text-sm font-bold',
                  active
                    ? 'border-foreground text-foreground'
                    : 'border-transparent text-muted-foreground hover:text-foreground',
                )}
              >
                {t(key)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/**
 * スマホの下のタブ（手本の Strava のアプリ）。真ん中に、今日の記録を足す丸いボタンを浮かせる。
 * 寸法は iPhone の標準のタブに寄せる（高さ 49pt・字 10pt。最初は 64px・12px で大きすぎた、本人 2026-10-11）。
 * iPhone のホームバーの分は safe-area で空ける
 */
export function TabBar() {
  const t = useTranslations('nav');
  const tLog = useTranslations('log');
  const isActive = useActive();

  const tab = ({ href, key, Icon }: (typeof TABS)[number]) => {
    const active = isActive(href);
    return (
      <li key={key} className="flex-1">
        <Link
          href={href}
          aria-current={active ? 'page' : undefined}
          className={cn(
            'flex h-full flex-col items-center justify-center gap-0.5 text-[10px] font-semibold',
            active ? 'text-foreground' : 'text-muted-foreground',
          )}
        >
          <Icon aria-hidden className="size-5.5" strokeWidth={active ? 2.5 : 1.75} />
          {t(key)}
        </Link>
      </li>
    );
  };

  return (
    <nav className="fixed inset-x-0 bottom-0 z-10 border-t border-border bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
      <ul className="mx-auto flex h-13 max-w-lg">
        {TABS.slice(0, 2).map(tab)}
        <li className="flex flex-1 justify-center">
          <Link
            href={RECORD_HREF}
            aria-label={tLog('recordToday')}
            className="-mt-4 flex size-14 items-center justify-center rounded-full bg-brand text-brand-foreground shadow-lg ring-4 ring-card transition active:scale-95"
          >
            <Plus aria-hidden className="size-7" strokeWidth={3} />
          </Link>
        </li>
        {TABS.slice(2).map(tab)}
      </ul>
    </nav>
  );
}
