import type { ReactNode } from 'react';
import { getTranslations } from 'next-intl/server';

/** コーチに見せるものの並び。コーチの画面（src/app/(app)/teams/[teamId]/members/[userId]/page.tsx）に合わせる */
const SHOWN = [
  'shownProfile',
  'shownAttempts',
  'shownCondition',
  'shownCompetitions',
  'shownVideos',
] as const;

/**
 * チームに入ると、そのチームのコーチに何を見せるか（2026-10-14）。招待の画面（/join/[token]）と、
 * 保護者の同意の画面（/guardian-consent/[token] のチームへの参加）で同じものを見せる。
 * 頭の文（intro）と、見せないもの・抜け方の文（notes）は、読む人（本人か保護者か）に合わせて呼ぶ側が渡す。
 * 画面に説明の文を置かない決まりの例外（同意の画面だから）
 */
export async function TeamShareDetails({
  intro,
  notes,
}: {
  intro: ReactNode;
  /** 見せないもの（メールアドレス）と、いつでも抜けられること */
  notes: { notShown: string; leave: string };
}) {
  const t = await getTranslations('teams');

  return (
    <>
      {intro}
      <ul className="flex list-disc flex-col gap-1 pl-5">
        {SHOWN.map((key) => (
          <li key={key}>{t(key)}</li>
        ))}
      </ul>
      <ul className="flex flex-col gap-2 text-muted-foreground">
        <li>{notes.notShown}</li>
        <li>{t('readOnly')}</li>
        <li>{notes.leave}</li>
      </ul>
    </>
  );
}
