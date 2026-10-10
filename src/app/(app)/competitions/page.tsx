import { getTranslations } from 'next-intl/server';
import { CompetitionsBoard } from '@/components/competitions-board';
import { PageTitle } from '@/components/layout-ui';
import { getProfile, listCompetitions } from '@/lib/data';
import { todayIn } from '@/lib/dates';
import { requireViewer } from '@/lib/viewer';

/** 大会の予定と、過去の大会。今日の大会は「これから」に入る */
export default async function Competitions() {
  const viewer = await requireViewer();
  const profile = (await getProfile(viewer.userId))!;
  const today = todayIn(profile.timeZone);
  const all = await listCompetitions(viewer.userId);
  const t = await getTranslations('nav');

  return (
    <main className="flex flex-col gap-3">
      <PageTitle>{t('competitions')}</PageTitle>
      <CompetitionsBoard
        upcoming={all.filter((c) => c.day >= today)}
        past={all.filter((c) => c.day < today).reverse()}
        today={today}
      />
    </main>
  );
}
