'use client';

import { CalendarDays, ChartLine, House, PencilLine, Settings } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';

const TABS = [
  { href: '/', key: 'home', Icon: House },
  { href: '/today', key: 'today', Icon: PencilLine },
  { href: '/calendar', key: 'calendar', Icon: CalendarDays },
  { href: '/analysis', key: 'analysis', Icon: ChartLine },
  { href: '/settings', key: 'settings', Icon: Settings },
] as const;

/** 下のタブ。iPhone のホームバーの分は safe-area で空ける */
export function TabBar() {
  const t = useTranslations('nav');
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-10 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
      <ul className="mx-auto flex h-16 max-w-lg">
        {TABS.map(({ href, key, Icon }) => {
          const active = href === '/' ? pathname === '/' : pathname.startsWith(href);
          return (
            <li key={key} className="flex-1">
              <Link
                href={href}
                aria-current={active ? 'page' : undefined}
                className={`flex h-full flex-col items-center justify-center gap-0.5 text-[11px] font-medium ${
                  active ? 'text-accent' : 'text-sub'
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
  );
}
