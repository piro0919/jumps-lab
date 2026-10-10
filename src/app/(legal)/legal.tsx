import Link from 'next/link';
import type { ReactNode } from 'react';

/**
 * 規約とポリシーの枠（spatto の Legal と同じ作り）。
 *
 * 日本語が正文で、英語は訳。食い違ったら日本語が勝つ。日本の運営者が日本法を準拠法にしているため。
 * 条と節の並びを日英で1対1にしてあるので、片方を直したらもう片方の同じ条を直し、改定日も動かす。
 * ログインの画面と Google の同意画面から踏まれるので、ログインしていなくても開ける（src/proxy.ts）
 */
const COPY = {
  ja: { updatedLabel: '最終改定日', other: 'English', note: null },
  en: {
    updatedLabel: 'Last updated',
    other: '日本語',
    note: 'This is a translation for reference. The Japanese version is the authoritative text; if the two differ, the Japanese version governs.',
  },
} as const;

export function Legal({
  title,
  doc,
  locale,
  updated,
  children,
}: {
  title: string;
  /** どちらの文書か。題名で見分けない */
  doc: 'terms' | 'privacy';
  locale: 'ja' | 'en';
  updated: string;
  children: ReactNode;
}) {
  const copy = COPY[locale];

  return (
    <main lang={locale} className="mx-auto max-w-2xl px-4 py-10">
      <div className="flex items-center justify-between gap-3 text-sm">
        <Link href="/" className="font-bold">
          Jumps Lab
        </Link>
        <Link href={locale === 'ja' ? `/en/${doc}` : `/${doc}`} className="underline">
          {copy.other}
        </Link>
      </div>
      <h1 className="mt-8 text-[28px] leading-snug font-bold tracking-tight">{title}</h1>
      <p className="mt-2 text-[13px] text-muted-foreground">
        {copy.updatedLabel}: {updated}
      </p>
      {copy.note && (
        <p className="mt-6 border-l-2 border-border pl-4 text-sm leading-relaxed text-muted-foreground">
          {copy.note}
        </p>
      )}
      {/* 文章だけのページなので、節の切れ目に線を引く */}
      <div className="mt-8 text-[15px] leading-relaxed [&_dd]:mb-3 [&_dt]:font-semibold [&_h2]:mt-8 [&_h2]:mb-3 [&_h2]:border-t [&_h2]:border-border [&_h2]:pt-6 [&_h2]:text-lg [&_h2]:font-bold [&_li]:mb-1.5 [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:mb-3 [&_ul]:list-disc [&_ul]:pl-6">
        {children}
      </div>
    </main>
  );
}
