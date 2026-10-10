import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { z } from 'zod';
import { CompetitionForm } from '@/components/competition-form';
import { BackLink, Card, PageTitle } from '@/components/layout-ui';
import { getCompetition } from '@/lib/data';
import { requireViewer } from '@/lib/viewer';

/** 大会を直す画面。本人の大会でなければ開かない */
export default async function EditCompetition({ params }: PageProps<'/competitions/[id]/edit'>) {
  const viewer = await requireViewer();
  const { id } = await params;
  const competition = z.uuid().safeParse(id).success
    ? await getCompetition(viewer.userId, id)
    : null;
  if (!competition) notFound();
  const t = await getTranslations('calendar');
  const tNav = await getTranslations('nav');

  return (
    <main className="flex flex-col gap-3 lg:mx-auto lg:w-full lg:max-w-xl">
      <BackLink href="/competitions">{tNav('competitions')}</BackLink>
      <PageTitle>{t('editCompetition')}</PageTitle>
      <Card>
        <CompetitionForm initial={competition} defaultDay={competition.day} />
      </Card>
    </main>
  );
}
