import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { AiConsentChoice } from '@/components/ai-consent';
import { AiConsentDetails } from '@/components/ai-consent-details';
import { Card, FORM_PAGE, PageTitle, SectionTitle } from '@/components/layout-ui';
import { MeetImport } from '@/components/meet-import';
import { aiConsenter, aiEnabled, aiUsable, asksAge, consentNotice } from '@/lib/ai';
import { latestGuardianRequest, listCompetitions } from '@/lib/data';
import { GUARDIAN_LINK_DAYS, maskEmail } from '@/lib/guardian';
import { requireProfile, requireViewer } from '@/lib/viewer';

/** 読み込みの Server Action を待つ上限（秒）。AI の上限（MEET_IMPORT_TIMEOUT_MS の 150 秒）とページを読む時間より長く */
export const maxDuration = 180;

/**
 * 大会の取り込み（src/lib/meet-import.ts）。Premium の人だけ（AI を使うため）。
 * まだ同意していない人には、AI コーチと同じ同意の画面を出す（送るものの一覧に大会の資料も入っている）
 */
export default async function ImportMeets() {
  const viewer = await requireViewer();
  const profile = await requireProfile(viewer.userId);
  if (!aiEnabled(profile)) redirect('/competitions');
  const usable = aiUsable(profile);
  const [competitions, request] = await Promise.all([
    usable ? listCompetitions(viewer.userId) : [],
    usable ? null : latestGuardianRequest(viewer.userId),
  ]);
  const t = await getTranslations('meetImport');
  const tNav = await getTranslations('nav');
  const tConsent = await getTranslations('aiConsent');
  const notice = consentNotice(profile);
  const title = (
    <PageTitle
      back={{ href: '/competitions', label: tNav('backTo', { page: tNav('competitions') }) }}
    >
      {t('title')}
    </PageTitle>
  );

  if (usable) {
    return (
      <main className={FORM_PAGE}>
        {title}
        <MeetImport added={competitions.map((c) => `${c.day}\n${c.name}`)} />
      </main>
    );
  }
  return (
    <main className={FORM_PAGE}>
      {title}
      <Card>
        <div className="flex flex-col gap-4 text-sm">
          <SectionTitle>{tConsent('title')}</SectionTitle>
          {notice && <p>{tConsent(notice)}</p>}
          <AiConsentDetails intro={<p>{tConsent('intro')}</p>} notSent={tConsent('notSent')} />
          <AiConsentChoice
            consenter={aiConsenter(profile)}
            askAge={asksAge(profile)}
            request={request && { email: maskEmail(request.guardianEmail), live: request.live }}
            linkDays={GUARDIAN_LINK_DAYS}
          />
        </div>
      </Card>
    </main>
  );
}
