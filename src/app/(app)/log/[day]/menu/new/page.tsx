import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { AiConsentForm } from '@/components/ai-consent';
import { Card, PageTitle, FORM_PAGE, SectionTitle } from '@/components/layout-ui';
import { MenuForm } from '@/components/menu-form';
import { aiEnabled, aiUsable } from '@/lib/ai';
import { getMenu, listCompetitionsBetween } from '@/lib/data';
import { todayIn } from '@/lib/dates';
import { requireProfile, requireViewer } from '@/lib/viewer';

/** 同意の画面の出典。米国の制度は個人情報保護委員会のまとめ、OpenAI の措置は OpenAI のデータの扱いのページ（2026-10-14 に読んだ） */
const US_SYSTEM_URL =
  'https://www.ppc.go.jp/enforcement/infoprovision/laws/offshore_report_america/';
const OPENAI_DATA_URL = 'https://developers.openai.com/api/docs/guides/your-data';

/** 送るものの並び。src/app/actions/menu.ts の menuContext と、送る入力・相談に合わせる */
const SENT = [
  'sentDate',
  'sentProfile',
  'sentBests',
  'sentCondition',
  'sentAttempts',
  'sentCompetitions',
  'sentSession',
  'sentMeet',
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
 * 今日のメニューを作る画面。作れるのは今日の分だけで、もう作ってあればメニューの画面へ送る。
 * AI のキーが無い環境と Free の人には開かない。
 * まだ同意していない人には、入力の代わりに、OpenAI（米国）へ何を送るかと同意のボタンを出す（2026-10-14）
 */
export default async function NewMenu({ params }: PageProps<'/log/[day]/menu/new'>) {
  const viewer = await requireViewer();
  const profile = await requireProfile(viewer.userId);
  const today = todayIn(profile.timeZone);
  const requested = (await params).day;
  if (!aiEnabled(profile) || (requested !== 'today' && requested !== today)) redirect('/');
  const [menu, meets] = await Promise.all([
    getMenu(viewer.userId, today),
    listCompetitionsBetween(viewer.userId, today, today),
  ]);
  // 同意する前に作ったメニューがある人も、相談の前にここで同意してもらう
  if (menu && aiUsable(profile)) redirect('/log/today/menu');
  const t = await getTranslations('menu');
  const tNav = await getTranslations('nav');
  const tConsent = await getTranslations('aiConsent');

  return (
    <main className={FORM_PAGE}>
      <PageTitle back={{ href: '/', label: tNav('backTo', { page: tNav('home') }) }}>
        {t('newTitle')}
      </PageTitle>
      <Card>
        {aiUsable(profile) ? (
          <MenuForm meetDay={meets.length > 0} />
        ) : (
          <div className="flex flex-col gap-4 text-sm">
            <SectionTitle>{tConsent('title')}</SectionTitle>
            <p>{tConsent('intro')}</p>
            <ul className="flex list-disc flex-col gap-1 pl-5">
              {SENT.map((key) => (
                <li key={key}>{tConsent(key)}</li>
              ))}
            </ul>
            <p>{tConsent('notSent')}</p>
            <SectionTitle>{tConsent('abroadTitle')}</SectionTitle>
            <ul className="flex flex-col gap-2 text-muted-foreground">
              <li>{tConsent('country')}</li>
              <li>
                {tConsent.rich('system', {
                  link: (chunks) => <SourceLink href={US_SYSTEM_URL}>{chunks}</SourceLink>,
                })}
              </li>
              <li>
                {tConsent.rich('measures', {
                  link: (chunks) => <SourceLink href={OPENAI_DATA_URL}>{chunks}</SourceLink>,
                })}
              </li>
            </ul>
            <p className="font-semibold">{tConsent('medical')}</p>
            <AiConsentForm />
          </div>
        )}
      </Card>
    </main>
  );
}
