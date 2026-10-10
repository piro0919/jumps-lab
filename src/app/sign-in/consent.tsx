import Link from 'next/link';
import { getLocale, getTranslations } from 'next-intl/server';

/**
 * ログインのボタンの下に置く、規約とポリシーへの同意の一文（押す動作の名前に合わせる。spatto と同じ）。
 * ログインの画面と LP で使う。行の長さをそろえ、日本語は文節の途中で折らない
 * （最後の行に「ものとみなします。」だけが落ちていた）。リンクの語は途中で折らない
 * （LP の幅で「プライバシー／ポリシー」と割れた。本人、2026-10-11）
 */
export async function Consent() {
  const t = await getTranslations('signIn');
  // 規約は日本語が /terms、英語が /en/terms
  const prefix = (await getLocale()) === 'ja' ? '' : '/en';

  return (
    <p className="text-xs leading-relaxed text-balance text-muted-foreground [word-break:auto-phrase]">
      {t.rich('consent', {
        terms: (chunks) => (
          <Link href={`${prefix}/terms`} className="whitespace-nowrap text-foreground underline">
            {chunks}
          </Link>
        ),
        privacy: (chunks) => (
          <Link href={`${prefix}/privacy`} className="whitespace-nowrap text-foreground underline">
            {chunks}
          </Link>
        ),
      })}
    </p>
  );
}
