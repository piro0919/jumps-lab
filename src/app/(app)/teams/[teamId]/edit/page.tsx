import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { z } from 'zod';
import { Card, CardTitle, FORM_PAGE, PageTitle } from '@/components/layout-ui';
import { DeleteTeamButton } from '@/components/team-buttons';
import { TeamForm } from '@/components/team-form';
import { getCoachedTeam } from '@/lib/data';
import { requireViewer } from '@/lib/viewer';

/** チームの名前を変える画面と、チームを消すボタン。コーチでなければ開かない */
export default async function EditTeam({ params }: PageProps<'/teams/[teamId]/edit'>) {
  const viewer = await requireViewer();
  const { teamId } = await params;
  const team = z.uuid().safeParse(teamId).success
    ? await getCoachedTeam(viewer.userId, teamId)
    : null;
  if (!team) notFound();
  const t = await getTranslations('teams');
  const tNav = await getTranslations('nav');

  return (
    <main className={FORM_PAGE}>
      <PageTitle back={{ href: `/teams/${team.id}`, label: tNav('backTo', { page: team.name }) }}>
        {t('edit')}
      </PageTitle>
      <Card>
        <TeamForm team={{ id: team.id, name: team.name }} />
      </Card>
      <Card>
        <CardTitle>{t('delete')}</CardTitle>
        <div className="flex flex-col items-start gap-4">
          <p className="text-sm text-muted-foreground">{t('deleteNote')}</p>
          <DeleteTeamButton teamId={team.id} />
        </div>
      </Card>
    </main>
  );
}
