import { Plus } from 'lucide-react';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { AccountMenu, type AccountSummary } from '@/components/account-menu';
import { InstallButton } from '@/components/install-button';
import { HeaderNav, RECORD_HREF } from '@/components/tab-bar';
import { buttonVariants } from '@/components/ui/button';
import { AppIcon, Wordmark } from '@/components/layout-ui';

/**
 * 画面の上端に貼り付く、幅いっぱいのヘッダー（手本の Strava）。
 * 左にアイコンと名前、幅 1024px 以上は真ん中に画面の切り替え。
 * 右端に今日の記録を足すボタン（スマホは下のタブの真ん中にあるので出さない）と、自分のアイコン（設定とログアウト）。
 * 地は画面の地の色を 7 割の濃さで塗ったすりガラス、下の線は付けない（本人、2026-10-11。はじめは地なしで、
 * 下を流れる本文と重なっていた）。左のアイコンと右の自分のアイコンは、
 * 「今日を記録」のボタンと同じ 36px にそろえる（32px だと小さく見えると言われた）。
 * minimal はようこその画面用。まだプロフィールが無く、ほかの画面へ進めないので、切り替えと記録のボタンを出さない
 */
export async function SiteHeader({
  name,
  email,
  image,
  minimal = false,
  profile,
}: {
  name: string;
  email: string;
  image: string | null;
  minimal?: boolean;
  /** ユーザーメニューに出す種目と数（ようこその画面ではまだ無い） */
  profile?: AccountSummary;
}) {
  const tMeta = await getTranslations('metadata');
  const tLog = await getTranslations('log');

  return (
    <header className="sticky top-0 z-40 flex h-16 items-center gap-6 bg-background/70 px-4 backdrop-blur-xl backdrop-saturate-150 lg:grid lg:grid-cols-[1fr_auto_1fr]">
      <Link href="/" className="flex w-fit items-center gap-2.5">
        <AppIcon size="header" />
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
        <InstallButton />
        <AccountMenu name={name} email={email} image={image} summary={profile} />
      </div>
    </header>
  );
}
