import { Plus } from 'lucide-react';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { AccountMenu } from '@/components/account-menu';
import { HeaderNav, RECORD_HREF } from '@/components/tab-bar';
import { buttonVariants } from '@/components/ui/button';

/**
 * 画面の上端に貼り付く、幅いっぱいのヘッダー（手本の Strava）。
 * 左にアイコンと名前、幅 1024px 以上はその右に画面の切り替え。
 * 右端に今日の記録を足すボタン（スマホは下のタブの真ん中にあるので出さない）と、自分のアイコン（設定とログアウト）。
 * 地の色と下の線は付けない（本人、2026-10-11）
 */
export async function SiteHeader({ name, image }: { name: string; image: string | null }) {
  const tMeta = await getTranslations('metadata');
  const tLog = await getTranslations('log');

  return (
    <header className="sticky top-0 z-40 flex h-16 items-center gap-6 px-4">
      <Link href="/" className="flex items-center gap-2.5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icon-192x192.png" alt="" className="size-8 rounded-xl" />
        <span className="text-lg font-bold tracking-tight">{tMeta('title')}</span>
      </Link>
      <HeaderNav />
      <div className="ml-auto flex items-center gap-3">
        <Link
          href={RECORD_HREF}
          className={buttonVariants({ variant: 'brand', size: 'sm', className: 'max-lg:hidden' })}
        >
          <Plus aria-hidden className="size-4" strokeWidth={3} />
          {tLog('recordToday')}
        </Link>
        <AccountMenu name={name} image={image} />
      </div>
    </header>
  );
}
