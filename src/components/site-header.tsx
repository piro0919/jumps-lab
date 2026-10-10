import { Plus } from 'lucide-react';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { AccountMenu } from '@/components/account-menu';
import { HeaderNav, RECORD_HREF } from '@/components/tab-bar';
import { buttonVariants } from '@/components/ui/button';
import { Wordmark } from '@/components/layout-ui';

/**
 * 画面の上端に貼り付く、幅いっぱいのヘッダー（手本の Strava）。
 * 左にアイコンと名前、幅 1024px 以上は真ん中に画面の切り替え。
 * 右端に今日の記録を足すボタン（スマホは下のタブの真ん中にあるので出さない）と、自分のアイコン（設定とログアウト）。
 * 地の色と下の線は付けない（本人、2026-10-11）。左のアイコンと右の自分のアイコンは、
 * 「今日を記録」のボタンと同じ 36px にそろえる（32px だと小さく見えると言われた）。
 * minimal はようこその画面用。まだプロフィールが無く、ほかの画面へ進めないので、切り替えと記録のボタンを出さない
 */
export async function SiteHeader({
  name,
  email,
  image,
  minimal = false,
}: {
  name: string;
  email: string;
  image: string | null;
  minimal?: boolean;
}) {
  const tMeta = await getTranslations('metadata');
  const tLog = await getTranslations('log');

  return (
    <header className="sticky top-0 z-40 flex h-16 items-center gap-6 px-4 lg:grid lg:grid-cols-[1fr_auto_1fr]">
      <Link href="/" className="flex w-fit items-center gap-2.5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icon-192x192.png" alt="" className="size-9 rounded-xl" />
        <Wordmark size="header">{tMeta('title')}</Wordmark>
      </Link>
      {minimal ? <span className="max-lg:hidden" /> : <HeaderNav />}
      <div className="ml-auto flex items-center gap-3">
        {!minimal && (
          <Link
            href={RECORD_HREF}
            className={buttonVariants({ variant: 'brand', size: 'sm', className: 'max-lg:hidden' })}
          >
            <Plus aria-hidden className="size-4" strokeWidth={3} />
            {tLog('recordToday')}
          </Link>
        )}
        <AccountMenu name={name} email={email} image={image} />
      </div>
    </header>
  );
}
