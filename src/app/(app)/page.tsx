import { ChevronRight, Plus } from 'lucide-react';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { PageTitle } from '@/components/layout-ui';
import { MarkEditor } from '@/components/mark-editor';
import { WeatherCard } from '@/components/weather-card';
import { computeBests } from '@/lib/bests';
import { getProfile, getTargets, listAllAttempts, nextCompetition } from '@/lib/data';
import { daysBetween, todayIn } from '@/lib/dates';
import { EVENT_BG, EVENT_MARK, type JumpEvent } from '@/lib/events';
import { formatMark, type Units } from '@/lib/units';
import { requireViewer } from '@/lib/viewer';

/**
 * 1種目のカード。種目の色で塗り、PB を画面いっぱいの数字で出す（手本の Nike Run Club の色付きのカード）。
 * その下に SB・練習ベスト・今季の目標を横に3つ。どの数字も押すとその場で手で直せる
 */
async function EventHero({
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

  return (
    <section
      className={`relative mx-4 overflow-hidden rounded-3xl p-5 text-white ${EVENT_BG[event]}`}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute -right-3 -bottom-8 font-display text-[160px] leading-none font-extrabold text-white/10 italic select-none"
      >
        {EVENT_MARK[event]}
      </span>
      <div className="relative flex flex-col gap-4">
        <h2 className="text-base font-extrabold">{tEvents(event)}</h2>
        <MarkEditor
          event={event}
          field="manualPbM"
          label={t('pb')}
          shown={bests.pbM}
          manual={manual.pbM}
          units={units}
          size="giant"
          inverse
        />
        <div className="grid grid-cols-3 gap-2">
          <MarkEditor
            event={event}
            field="manualSbM"
            label={t('sb')}
            shown={bests.sbM}
            manual={manual.sbM}
            units={units}
            inverse
          />
          <MarkEditor
            event={event}
            field="manualPracticeBestM"
            label={t('practiceBest')}
            shown={bests.practiceBestM}
            manual={manual.practiceBestM}
            units={units}
            inverse
          />
          <MarkEditor
            event={event}
            field="seasonGoalM"
            label={t('goal')}
            shown={goalM}
            manual={goalM}
            units={units}
            inverse
          />
        </div>
        {gap !== null && (
          <p className="w-fit rounded-full bg-white/15 px-3 py-1 text-sm font-bold">
            {gap <= 0 ? t('goalReached') : t('toGoal', { distance: formatMark(gap, units) })}
          </p>
        )}
      </div>
    </section>
  );
}

/** ホーム。本人の選んだ種目ごとの色付きのカードと、次の大会・天気 */
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
  const days = competition ? daysBetween(today, competition.day) : null;

  return (
    <main className="flex flex-col gap-3">
      <PageTitle
        action={
          <Link
            href="/log/today"
            className="inline-flex h-9 items-center gap-1 rounded-full bg-foreground px-4 text-sm font-bold text-background"
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
              <EventHero
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
          {/* 次の大会は黒いカード。残りの日数を大きな数字で */}
          <Link
            href="/competitions"
            className="mx-4 flex items-center gap-4 rounded-3xl bg-foreground p-5 text-background"
          >
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="text-sm font-bold">{t('nextCompetition')}</span>
              <span className="truncate text-lg font-extrabold">
                {competition ? competition.name : t('noCompetition')}
              </span>
            </div>
            {/* 当日は数字を出さず「今日」とだけ出す */}
            {days === 0 && (
              <span className="shrink-0 text-2xl font-extrabold">{t('daysLeft', { days })}</span>
            )}
            {days !== null && days > 0 && (
              <div className="flex shrink-0 flex-col items-end">
                <span className="font-display text-[56px] leading-[0.9] font-extrabold tabular-nums italic">
                  {days}
                </span>
                <span className="text-sm font-bold">{t('daysUnit', { days })}</span>
              </div>
            )}
            <ChevronRight aria-hidden className="size-5 shrink-0" />
          </Link>
          <WeatherCard />
        </div>
      </div>
    </main>
  );
}
