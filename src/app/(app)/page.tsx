import { Plus } from 'lucide-react';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { Card, CardTitle, PageTitle } from '@/components/layout-ui';
import { MarkEditor } from '@/components/mark-editor';
import { WeatherCard } from '@/components/weather-card';
import { computeBests } from '@/lib/bests';
import { getProfile, getTargets, listAllAttempts, nextCompetition } from '@/lib/data';
import { daysBetween, todayIn } from '@/lib/dates';
import type { JumpEvent } from '@/lib/events';
import { formatMark, type Units } from '@/lib/units';
import { requireViewer } from '@/lib/viewer';

/** 1種目のカード。今季の目標と、PB・SB・練習ベスト（記録から出した値と手で入れた値の高い方） */
async function EventCard({
  event,
  goalM,
  bests,
  manual,
  units,
}: {
  event: JumpEvent;
  goalM: number | null;
  bests: { pbM: number | null; sbM: number | null; practiceBestM: number | null };
  manual: { pbM: number | null; sbM: number | null; practiceBestM: number | null };
  units: Units;
}) {
  const t = await getTranslations('home');
  const tEvents = await getTranslations('events');
  // 目標までの差は SB から測る（今季の目標なので）
  const gap = goalM !== null && bests.sbM !== null ? goalM - bests.sbM : null;

  /*
   * 手本の Nike Run Club の要約の形。主役の PB を大きく、その下に SB・練習ベスト・今季の目標を横に3つ。
   * どの数字も押すとその場で手で直せる
   */
  return (
    <Card className="flex flex-col gap-4">
      <h2 className="text-sm font-bold">{tEvents(event)}</h2>
      <MarkEditor
        event={event}
        field="manualPbM"
        label={t('pb')}
        shown={bests.pbM}
        manual={manual.pbM}
        units={units}
        large
      />
      <div className="grid grid-cols-3 gap-2">
        <MarkEditor
          event={event}
          field="manualSbM"
          label={t('sb')}
          shown={bests.sbM}
          manual={manual.sbM}
          units={units}
        />
        <MarkEditor
          event={event}
          field="manualPracticeBestM"
          label={t('practiceBest')}
          shown={bests.practiceBestM}
          manual={manual.practiceBestM}
          units={units}
        />
        <MarkEditor
          event={event}
          field="seasonGoalM"
          label={t('goal')}
          shown={goalM}
          manual={goalM}
          units={units}
        />
      </div>
      {gap !== null && (
        <p
          className={`-mt-1 text-sm font-semibold ${gap <= 0 ? 'text-good' : 'text-muted-foreground'}`}
        >
          {gap <= 0 ? t('goalReached') : t('toGoal', { distance: formatMark(gap, units) })}
        </p>
      )}
    </Card>
  );
}

/** ホーム。本人の選んだ種目ごとのカードと、次の大会・天気 */
export default async function Home() {
  const viewer = await requireViewer();
  const profile = (await getProfile(viewer.userId))!;
  const today = todayIn(profile.timeZone);
  const [targets, attempts, competition] = await Promise.all([
    getTargets(viewer.userId, profile.events),
    listAllAttempts(viewer.userId),
    nextCompetition(viewer.userId, today),
  ]);
  const t = await getTranslations('home');
  const tNav = await getTranslations('nav');
  const tLog = await getTranslations('log');

  return (
    <main className="flex flex-col gap-3">
      <PageTitle
        action={
          <Link
            href="/log/today"
            className="inline-flex h-9 items-center gap-1 rounded-full bg-primary px-3.5 text-sm font-semibold text-primary-foreground"
          >
            <Plus aria-hidden className="size-4" />
            {tLog('recordToday')}
          </Link>
        }
      >
        {tNav('home')}
      </PageTitle>

      <div className="flex flex-col gap-3 lg:grid lg:grid-cols-2 lg:items-start">
        <div className="flex flex-col gap-3">
          {profile.events.map((event) => {
            const target = targets.get(event)!;
            return (
              <EventCard
                key={event}
                event={event}
                goalM={target.seasonGoalM}
                bests={computeBests(
                  attempts.filter((a) => a.event === event),
                  {
                    pbM: target.manualPbM,
                    // 手で入れた SB は、入れたシーズンのあいだだけ数える
                    sbM: target.manualSbM,
                    sbSeason: target.manualSbSeason,
                    practiceBestM: target.manualPracticeBestM,
                  },
                  today,
                  profile.seasonStartMonth,
                )}
                manual={{
                  pbM: target.manualPbM,
                  sbM: target.manualSbSeason === null ? null : target.manualSbM,
                  practiceBestM: target.manualPracticeBestM,
                }}
                units={profile.units}
              />
            );
          })}
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
