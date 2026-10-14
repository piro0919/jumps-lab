import { getTranslations } from 'next-intl/server';
import { Card, FORM_PAGE, PageTitle } from '@/components/layout-ui';
import { TeamForm } from '@/components/team-form';
import { requireProfile, requireViewer } from '@/lib/viewer';

/** チームを作る画面。作った人がそのチームのコーチになる */
export default async function NewTeam() {
  const viewer = await requireViewer();
  await requireProfile(viewer.userId);
  const t = await getTranslations('teams');
  const tNav = await getTranslations('nav');

  return (
    <main className={FORM_PAGE}>
      <PageTitle back={{ href: '/teams', label: tNav('backTo', { page: t('title') }) }}>
        {t('create')}
      </PageTitle>
      <Card>
        <TeamForm team={null} />
      </Card>
    </main>
  );
}
