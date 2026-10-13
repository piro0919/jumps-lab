import Link from 'next/link';
import type { ReactNode } from 'react';
import { AppIcon, Card, FORM_PAGE, PageTitle, Wordmark } from '@/components/layout-ui';

/**
 * 誤りの画面と見つからない画面の形。題と、文と操作を入れたカード1枚。
 * frame は置く場所: app はログインの中（ヘッダーとタブの内側）、bare はヘッダーの無い所
 * （アプリの外枠ごと描けなかったとき・知らない URL）で、ログインの画面と同じく上にアイコンとロゴを置く。
 * どちらもホームへ戻れるようにする（行き止まりにしない）
 */
export function ErrorScreen({
  frame,
  brand,
  title,
  body,
  detail,
  actions,
}: {
  frame: 'app' | 'bare';
  /** ロゴの文字（metadata.title）。bare のときだけ使う */
  brand: string;
  title: string;
  body: string;
  /** 小さく添える行（誤りの番号） */
  detail?: string;
  actions: ReactNode;
}) {
  const content = (
    <>
      <PageTitle>{title}</PageTitle>
      <Card className="flex flex-col gap-4">
        <p className="text-sm">{body}</p>
        {detail && <p className="text-xs text-muted-foreground">{detail}</p>}
        <div className="flex flex-wrap items-center justify-end gap-3">{actions}</div>
      </Card>
    </>
  );

  if (frame === 'app') return <main className={FORM_PAGE}>{content}</main>;
  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center gap-3 py-10">
      <Link href="/" className="mb-4 flex flex-col items-center gap-4 self-center">
        <AppIcon size="hero" />
        <Wordmark size="hero">{brand}</Wordmark>
      </Link>
      {content}
    </main>
  );
}
