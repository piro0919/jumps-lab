import type { ReactNode } from 'react';
import { getTranslations } from 'next-intl/server';
import { SectionTitle } from '@/components/layout-ui';

/** 同意の画面の出典。米国の制度は個人情報保護委員会のまとめ、OpenAI の措置は OpenAI のデータの扱いのページ（2026-10-14 に読んだ） */
const US_SYSTEM_URL =
  'https://www.ppc.go.jp/enforcement/infoprovision/laws/offshore_report_america/';
const OPENAI_DATA_URL = 'https://developers.openai.com/api/docs/guides/your-data';

/** 送るものの並び。src/app/actions/menu.ts の menuContext と、送る入力・相談、大会の取り込み（src/app/actions/meet-import.ts）に合わせる */
const SENT = [
  'sentDate',
  'sentProfile',
  'sentBests',
  'sentCondition',
  'sentAttempts',
  'sentCompetitions',
  'sentSession',
  'sentMeet',
  'sentImport',
] as const;

/** 出典へのリンク。別のタブで開く */
function SourceLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className="text-foreground underline">
      {children}
    </a>
  );
}

/**
 * AI コーチの同意の中身（何を・どこへ送るか、送り先の国の制度と OpenAI の措置、診断をしないこと）。
 * 本人の同意の画面（/log/[day]/menu/new）と保護者の同意の画面（/guardian-consent/[token]）で同じものを見せる。
 * 頭の文（intro）と「送らないもの」（notSent）だけは、読む人に合わせて呼ぶ側が渡す
 */
export async function AiConsentDetails({
  intro,
  notSent,
}: {
  intro: ReactNode;
  notSent: ReactNode;
}) {
  const t = await getTranslations('aiConsent');

  return (
    <>
      {intro}
      <ul className="flex list-disc flex-col gap-1 pl-5">
        {SENT.map((key) => (
          <li key={key}>{t(key)}</li>
        ))}
      </ul>
      <p>{notSent}</p>
      <SectionTitle>{t('abroadTitle')}</SectionTitle>
      <ul className="flex flex-col gap-2 text-muted-foreground">
        <li>{t('country')}</li>
        <li>
          {t.rich('system', {
            link: (chunks) => <SourceLink href={US_SYSTEM_URL}>{chunks}</SourceLink>,
          })}
        </li>
        <li>
          {t.rich('measures', {
            link: (chunks) => <SourceLink href={OPENAI_DATA_URL}>{chunks}</SourceLink>,
          })}
        </li>
      </ul>
      <p className="font-semibold">{t('medical')}</p>
    </>
  );
}
