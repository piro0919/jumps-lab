import { getTranslations } from 'next-intl/server';
import { CompetitionsBoard } from '@/components/competitions-board';
import { competitionResults } from '@/lib/competition-results';
import { listAllAttempts, listCompetitions } from '@/lib/data';
import { todayIn } from '@/lib/dates';
import { inJapan } from '@/lib/japan';
import { requireProfile, requireViewer } from '@/lib/viewer';

/**
 * 大会の予定と、過去の大会。今日の大会は「これから」に入る。
 * 大会の日に「大会」として入れた記録を、その大会の結果として出す
 */
export default async function Competitions() {
  const viewer = await requireViewer();
  const profile = await requireProfile(viewer.userId);
  const today = todayIn(profile.timeZone);
  const [all, attempts] = await Promise.all([
    listCompetitions(viewer.userId),
    listAllAttempts(viewer.userId),
  ]);
  const t = await getTranslations('nav');

  return (
    <main className="flex flex-col gap-3">
      <CompetitionsBoard
        title={t('competitions')}
        upcoming={all.filter((c) => c.day >= today)}
        past={all.filter((c) => c.day < today).reverse()}
        results={Object.fromEntries(competitionResults(attempts))}
        units={profile.units}
        today={today}
        prefectureLinks={inJapan(profile.timeZone)}
      />
    </main>
  );
}
