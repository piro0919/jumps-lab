import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { EventSwitcher } from '@/components/event-switcher';
import { MarkEditor } from '@/components/mark-editor';
import { Card, CardTitle, PageTitle } from '@/components/layout-ui';
import { WeatherCard } from '@/components/weather-card';
import { computeBests } from '@/lib/bests';
import { getProfile, getTarget, listAttempts, nextCompetition } from '@/lib/data';
import { daysBetween, todayIn } from '@/lib/dates';
import { formatMark } from '@/lib/units';
import { requireViewer } from '@/lib/viewer';

export default async function Home() {
  const viewer = await requireViewer();
  const profile = (await getProfile(viewer.userId))!;
  const today = todayIn(profile.timeZone);
  const [target, attempts, competition] = await Promise.all([
    getTarget(viewer.userId, profile.currentEvent),
    listAttempts(viewer.userId, profile.currentEvent),
    nextCompetition(viewer.userId, today),
  ]);
  const bests = computeBests(
    attempts,
    {
      pbM: target.manualPbM,
      sbM: target.manualSbM,
      sbSeason: target.manualSbSeason,
      practiceBestM: target.manualPracticeBestM,
    },
    today,
    profile.seasonStartMonth,
  );
  const t = await getTranslations('home');
  const tNav = await getTranslations('nav');

  // 目標までの差は SB から測る（今季の目標なので）
  const gap =
    target.seasonGoalM !== null && bests.sbM !== null ? target.seasonGoalM - bests.sbM : null;

  return (
    <main className="flex flex-col gap-3">
      <PageTitle action={<EventSwitcher events={profile.events} current={profile.currentEvent} />}>
        {tNav('home')}
      </PageTitle>

      <div className="flex flex-col gap-3 lg:grid lg:grid-cols-2 lg:items-start">
        <div className="flex flex-col gap-3">
          <Card className="flex flex-col gap-2">
            <MarkEditor
              field="seasonGoalM"
              label={t('goal')}
              shown={target.seasonGoalM}
              manual={target.seasonGoalM}
              units={profile.units}
              large
            />
            {gap !== null && (
              <p
                className={`text-sm font-semibold ${gap <= 0 ? 'text-good' : 'text-muted-foreground'}`}
              >
                {gap <= 0
                  ? t('goalReached')
                  : t('toGoal', { distance: formatMark(gap, profile.units) })}
              </p>
            )}
          </Card>

          <Card className="flex flex-col divide-y divide-border [&>*]:py-3 [&>*:first-child]:pt-0 [&>*:last-child]:pb-0">
            <MarkEditor
              field="manualPbM"
              label={t('pb')}
              shown={bests.pbM}
              manual={target.manualPbM}
              units={profile.units}
            />
            <MarkEditor
              field="manualSbM"
              label={t('sb')}
              shown={bests.sbM}
              manual={target.manualSbSeason === null ? null : target.manualSbM}
              units={profile.units}
            />
            <MarkEditor
              field="manualPracticeBestM"
              label={t('practiceBest')}
              shown={bests.practiceBestM}
              manual={target.manualPracticeBestM}
              units={profile.units}
            />
          </Card>
        </div>
        <div className="flex flex-col gap-3">
          <Link href="/competitions">
            <Card>
              <CardTitle>{t('nextCompetition')}</CardTitle>
              {competition ? (
                <div className="flex items-baseline justify-between gap-3">
                  <span className="min-w-0 truncate text-lg font-bold">{competition.name}</span>
                  <span className="shrink-0 text-lg font-bold text-primary tabular-nums">
                    {t('daysLeft', { days: daysBetween(today, competition.day) })}
                  </span>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">{t('noCompetition')}</p>
              )}
            </Card>
          </Link>

          <WeatherCard />
        </div>
      </div>
    </main>
  );
}
