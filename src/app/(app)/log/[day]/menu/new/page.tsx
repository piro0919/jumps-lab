import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { AiConsentChoice } from '@/components/ai-consent';
import { AiConsentDetails } from '@/components/ai-consent-details';
import { Card, PageTitle, FORM_PAGE, SectionTitle } from '@/components/layout-ui';
import { MenuForm } from '@/components/menu-form';
import { AI_CONSENT_VERSION, aiConsenter, aiEnabled, aiUsable } from '@/lib/ai';
import { getMenu, latestGuardianRequest, listCompetitionsBetween } from '@/lib/data';
import { todayIn } from '@/lib/dates';
import { GUARDIAN_LINK_DAYS, maskEmail } from '@/lib/guardian';
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
  if (!aiEnabled(profile) || (requested !== 'today' && requested !== today)) redirect('/');
  const usable = aiUsable(profile);
  const [menu, meets, request] = await Promise.all([
    getMenu(viewer.userId, today),
    listCompetitionsBetween(viewer.userId, today, today),
    usable ? null : latestGuardianRequest(viewer.userId),
  ]);
  // 同意する前に作ったメニューがある人も、相談の前にここで同意してもらう
  if (menu && usable) redirect('/log/today/menu');
  const t = await getTranslations('menu');
  const tNav = await getTranslations('nav');
  const tConsent = await getTranslations('aiConsent');

  return (
    <main className={FORM_PAGE}>
      <PageTitle back={{ href: '/', label: tNav('backTo', { page: tNav('home') }) }}>
        {t('newTitle')}
      </PageTitle>
      <Card>
        {usable ? (
          <MenuForm meetDay={meets.length > 0} />
        ) : (
          <div className="flex flex-col gap-4 text-sm">
            <SectionTitle>{tConsent('title')}</SectionTitle>
            {/* 前の版に同意した人（本人か保護者）には、聞き直す理由を出す */}
            {[profile.aiConsentVersion, profile.aiGuardianConsentVersion].some(
              (version) => version !== null && version !== AI_CONSENT_VERSION,
            ) && <p>{tConsent('changed')}</p>}
            <AiConsentDetails intro={<p>{tConsent('intro')}</p>} notSent={tConsent('notSent')} />
            <AiConsentChoice
              consenter={aiConsenter(profile)}
              askAge={profile.birthdate === null}
              request={request && { email: maskEmail(request.guardianEmail), live: request.live }}
              linkDays={GUARDIAN_LINK_DAYS}
            />
          </div>
        )}
      </Card>
    </main>
  );
}
