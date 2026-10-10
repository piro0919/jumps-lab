import { ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { DisplayNumber, PageTitle, SectionTitle, MAIN_SIDE } from '@/components/layout-ui';
import { EventHero } from '@/components/event-hero';
import { WeatherCard } from '@/components/weather-card';
import { computeBests } from '@/lib/bests';
import { getDayLog, getTargets, listAllAttempts, nextCompetition } from '@/lib/data';
import { ConditionCard } from '@/components/condition-card';
import { daysBetween, seasonOf, todayIn } from '@/lib/dates';
import { requireProfile, requireViewer } from '@/lib/viewer';

/**
 * ホーム。幅 1024px 以上は2列：左に種目ごとの色付きのカード、右に次の大会・今日のコンディション・天気。
 * スマホは種目のカードから縦に積む。自分のカード（顔・名前・本数）は外した。顔と名前はユーザーメニューにあり、
 * 本数は分析で見られるため（本人、2026-10-11）
 */
export default async function Home() {
  const viewer = await requireViewer();
  const profile = await requireProfile(viewer.userId);
  const today = todayIn(profile.timeZone);
  const [targets, attempts, competition, todayLog] = await Promise.all([
    getTargets(viewer.userId, profile.events),
    listAllAttempts(viewer.userId),
    nextCompetition(viewer.userId, today),
    getDayLog(viewer.userId, today),
  ]);
  const t = await getTranslations('home');
  const tNav = await getTranslations('nav');
  const days = competition ? daysBetween(today, competition.day) : null;

  return (
    <main className="flex flex-col gap-3">
      <PageTitle>{tNav('home')}</PageTitle>

      <div className={MAIN_SIDE}>
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
                  sbM:
                    target.manualSbSeason === seasonOf(today, profile.seasonStartMonth)
                      ? target.manualSbM
                      : null,
                  practiceBestM: target.manualPracticeBestM,
                }}
                units={profile.units}
              />
            );
          })}
        </div>
        <div className="flex flex-col gap-3">
          {/* 次の大会はアプリの青のカード。残りの日数を大きな数字で（黒は怖いと言われた。本人、2026-10-11） */}
          <Link
            href="/competitions"
            className="mx-4 flex items-center gap-4 rounded-3xl bg-primary p-5 text-primary-foreground"
          >
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <SectionTitle inverse="primary">{t('nextCompetition')}</SectionTitle>
              <span className="truncate text-lg font-extrabold">
                {competition ? competition.name : t('noCompetition')}
              </span>
            </div>
            {/* 当日は数字を出さず「今日」とだけ出す */}
            {days === 0 && (
              <span className="shrink-0 text-lg font-extrabold">{t('daysLeft', { days })}</span>
            )}
            {days !== null && days > 0 && (
              <div className="flex shrink-0 flex-col items-end">
                <DisplayNumber size="hero">{days}</DisplayNumber>
                <span className="text-sm font-bold">{t('daysUnit', { days })}</span>
              </div>
            )}
            <ChevronRight aria-hidden className="size-5 shrink-0" />
          </Link>
          {/* 今日のコンディション。押すと直す画面へ移り、保存したらホームへ戻る */}
          <ConditionCard
            log={todayLog}
            editHref="/log/today/condition?from=home"
            title={t('todayCondition')}
          />
          <WeatherCard />
        </div>
      </div>
    </main>
  );
}
