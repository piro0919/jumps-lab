import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { AiConsentChoice } from '@/components/ai-consent';
import { AiConsentDetails } from '@/components/ai-consent-details';
import { Card, PageTitle, FORM_PAGE, SectionTitle } from '@/components/layout-ui';
import { MenuForm } from '@/components/menu-form';
import { aiConsenter, aiEnabled, aiUsable, asksAge, consentNotice } from '@/lib/ai';
import {
  getMenu,
  latestGuardianRequest,
  listCompetitionsBetween,
  listConditionsBetween,
} from '@/lib/data';
import { addDays, todayIn } from '@/lib/dates';
import { INJURY_LOOKBACK_DAYS, injuryToAsk } from '@/lib/injury';
import { GUARDIAN_LINK_DAYS, maskEmail } from '@/lib/guardian';
import { hasCondition } from '@/lib/condition-input';
import { weatherAccess } from '@/lib/joint-use';
import { requireProfile, requireViewer } from '@/lib/viewer';

/**
 * 今日のメニューを作る画面。作れるのは今日の分だけで、もう作ってあればメニューの画面へ送る。
 * AI のキーが無い環境と Free の人には開かない。
 * まだ同意していない人には、入力の代わりに、OpenAI（米国）へ何を送るかと同意のボタンを出す（2026-10-14）。
 * 16歳未満（生年月日か本人の答えで決める。src/lib/guardian.ts）の人には、同意のボタンの代わりに
 * 保護者のメールアドレスの欄を出し、保護者がメールのリンクから同意する
 */
export default async function NewMenu({ params }: PageProps<'/log/[day]/menu/new'>) {
  const viewer = await requireViewer();
  const profile = await requireProfile(viewer.userId);
  const today = todayIn(profile.timeZone);
  const requested = (await params).day;
  if (!aiEnabled(profile) || (requested !== 'today' && requested !== today)) redirect('/analysis');
  const usable = aiUsable(profile);
  const [menu, meets, request, logs] = await Promise.all([
    getMenu(viewer.userId, today),
    listCompetitionsBetween(viewer.userId, today, today),
    usable ? null : latestGuardianRequest(viewer.userId),
    listConditionsBetween(viewer.userId, addDays(today, -INJURY_LOOKBACK_DAYS), today),
  ]);
  // 同意する前に作ったメニューがある人も、相談の前にここで同意してもらう
  if (menu && usable) redirect('/log/today/menu');
  const t = await getTranslations('menu');
  const tNav = await getTranslations('nav');
  const tConsent = await getTranslations('aiConsent');
  const notice = consentNotice(profile);

  return (
    <main className={FORM_PAGE}>
      <PageTitle back={{ href: '/analysis', label: tNav('backTo', { page: tNav('analysis') }) }}>
        {t('newTitle')}
      </PageTitle>
      <Card>
        {usable ? (
          <MenuForm
            meetDay={meets.length > 0}
            askCondition={!logs.some((log) => log.day === today && hasCondition(log))}
            injury={injuryToAsk(logs, today)}
            weatherAccess={weatherAccess(profile, today, today)}
            units={profile.units}
          />
        ) : (
          <div className="flex flex-col gap-4 text-sm">
            <SectionTitle>{tConsent('title')}</SectionTitle>
            {/* 前の版に同意した人と、年齢を聞く前に同意した人には、聞き直す理由を出す */}
            {notice && <p>{tConsent(notice)}</p>}
            <AiConsentDetails intro={<p>{tConsent('intro')}</p>} notSent={tConsent('notSent')} />
            <AiConsentChoice
              consenter={aiConsenter(profile)}
              askAge={asksAge(profile)}
              request={request && { email: maskEmail(request.guardianEmail), live: request.live }}
              linkDays={GUARDIAN_LINK_DAYS}
            />
          </div>
        )}
      </Card>
    </main>
  );
}
