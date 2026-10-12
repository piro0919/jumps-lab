import { getTranslations } from 'next-intl/server';
import { CompetitionForm } from '@/components/competition-form';
import { Card, PageTitle, FORM_PAGE } from '@/components/layout-ui';
import { todayIn } from '@/lib/dates';
import { inJapan, JAAF_ENTRY_URL } from '@/lib/japan';
import { requireProfile, requireViewer } from '@/lib/viewer';

/** 大会を足す画面。日付ははじめ今日。日本の人は申し込みのサイトに日本陸連の申し込みサイトを入れておく */
export default async function NewCompetition() {
  const viewer = await requireViewer();
  const profile = await requireProfile(viewer.userId);
  const t = await getTranslations('calendar');
  const tNav = await getTranslations('nav');

  return (
    <main className={FORM_PAGE}>
      <PageTitle
        back={{ href: '/competitions', label: tNav('backTo', { page: tNav('competitions') }) }}
      >
        {t('addCompetition')}
      </PageTitle>
      <Card>
        <CompetitionForm
          initial={null}
          defaultDay={todayIn(profile.timeZone)}
          defaultEntryUrl={inJapan(profile.timeZone) ? JAAF_ENTRY_URL : ''}
        />
      </Card>
    </main>
  );
}
