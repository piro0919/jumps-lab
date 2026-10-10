import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { AccountMenu } from '@/components/account-menu';

/**
 * 画面の上端に貼り付く、幅いっぱいのヘッダー（鯉魂・spatto と同じ枠）。
 * 左にアイコンと名前、右に自分のアイコン（設定とログアウトはそのメニューから）。地を少し透かし、下を流れる中身が見える
 */
export async function SiteHeader({ name, image }: { name: string; image: string | null }) {
  const tMeta = await getTranslations('metadata');

  return (
    <header className="sticky top-0 z-40 flex h-16 items-center gap-3 border-b border-border bg-card/85 px-4 backdrop-blur-md">
      <Link href="/" className="flex items-center gap-2.5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icon-192x192.png" alt="" className="size-8 rounded-lg" />
        <span className="text-lg font-bold tracking-tight">{tMeta('title')}</span>
      </Link>
      <div className="ml-auto flex items-center gap-2">
        <AccountMenu name={name} image={image} />
      </div>
    </header>
  );
}
