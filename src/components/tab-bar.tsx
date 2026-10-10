'use client';

import { ChartLine, House, NotebookPen, Settings, Trophy } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';

const TABS = [
  { href: '/', key: 'home', Icon: House },
  { href: '/log', key: 'log', Icon: NotebookPen },
  { href: '/competitions', key: 'competitions', Icon: Trophy },
  { href: '/analysis', key: 'analysis', Icon: ChartLine },
] as const;

/** サイドメニューの下端に置くもの。スマホでは自分のアイコンのメニューから開く */
const SIDE_BOTTOM = [{ href: '/settings', key: 'settings', Icon: Settings }] as const;

function useActive() {
  const pathname = usePathname();
  return (href: string) => (href === '/' ? pathname === '/' : pathname.startsWith(href));
}

/**
 * 画面の切り替え。スマホは下のタブ（iPhone のホームバーの分は safe-area で空ける）、
 * 幅 1024px 以上はヘッダーの下の左のメニューで、設定だけをその下端に置く
 */
export function TabBar() {
  const t = useTranslations('nav');
  const isActive = useActive();

  const sideLink = ({ href, key, Icon }: (typeof TABS | typeof SIDE_BOTTOM)[number]) => {
    const active = isActive(href);
    return (
      <li key={key}>
        <Link
          href={href}
          aria-current={active ? 'page' : undefined}
          className={`flex h-10 items-center gap-3 rounded-xl px-3 text-sm font-bold ${
            active ? 'bg-secondary text-primary' : 'text-foreground hover:bg-accent'
          }`}
        >
          <Icon aria-hidden className="size-5" strokeWidth={active ? 2.25 : 1.75} />
          {t(key)}
        </Link>
      </li>
    );
  };

  return (
    <>
      <nav className="fixed inset-x-0 bottom-0 z-10 border-t border-border bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
        <ul className="mx-auto flex h-16 max-w-lg">
          {TABS.map(({ href, key, Icon }) => {
            const active = isActive(href);
            return (
              <li key={key} className="flex-1">
                <Link
                  href={href}
                  aria-current={active ? 'page' : undefined}
                  className={`flex h-full flex-col items-center justify-center gap-0.5 text-xs font-semibold ${
                    active ? 'text-primary' : 'text-muted-foreground'
                  }`}
                >
                  <Icon aria-hidden className="size-6" strokeWidth={active ? 2.25 : 1.75} />
                  {t(key)}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <nav className="fixed top-16 bottom-0 left-0 z-10 hidden w-60 flex-col px-3 py-4 lg:flex">
        <ul className="flex flex-col gap-1">{TABS.map(sideLink)}</ul>
        <ul className="mt-auto flex flex-col gap-1 border-t border-border pt-4">
          {SIDE_BOTTOM.map(sideLink)}
        </ul>
      </nav>
    </>
  );
}
