'use client';

import { ChartLine, House, NotebookPen, Plus, Trophy } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { cn } from 'cn';
import { segmentClass } from '@/components/layout-ui';

const TABS = [
  { href: '/', key: 'home', Icon: House },
  { href: '/log', key: 'log', Icon: NotebookPen },
  { href: '/competitions', key: 'competitions', Icon: Trophy },
  { href: '/analysis', key: 'analysis', Icon: ChartLine },
] as const;

/** 今日の試技を足す入口（下のタブの真ん中とヘッダー）。足す画面を直接開く */
export const RECORD_HREF = '/log/today/new';

function useActive() {
  const pathname = usePathname();
  return (href: string) => (href === '/' ? pathname === '/' : pathname.startsWith(href));
}

/**
 * 幅 1024px 以上の画面の切り替え。ヘッダーの真ん中に横に並べる（手本の Strava の上のメニュー）。
 * 形は画面の中の切り替えと同じ丸い札で、白い帯に載せて灰色の地から浮かせる。
 * 最初は下線の形にしたが、ださいと言われた（本人、2026-10-11）
 */
export function HeaderNav() {
  const t = useTranslations('nav');
  const isActive = useActive();

  return (
    <nav className="hidden lg:block">
      <ul className="flex gap-1 rounded-full bg-card p-1 shadow-sm">
        {TABS.map(({ href, key, Icon }) => {
          const active = isActive(href);
          return (
            <li key={key}>
              <Link
                href={href}
                aria-current={active ? 'page' : undefined}
                className={cn(segmentClass(active), 'gap-1.5')}
              >
                <Icon aria-hidden className="size-4" strokeWidth={active ? 2.5 : 2} />
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
