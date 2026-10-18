import { ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { DisplayNumber, PageTitle, SectionTitle, MAIN_SIDE } from '@/components/layout-ui';
import { EventHero } from '@/components/event-hero';
import { TeamsCard } from '@/components/teams-card';
import { WeatherCard } from '@/components/weather-card';
import { eventBests } from '@/lib/bests';
import {
  coachedTeamSummaries,
  getDayLog,
  getTargets,
  listAllAttempts,
  nextCompetition,
} from '@/lib/data';
import { ConditionCard } from '@/components/condition-card';
import { daysBetween, seasonOf, todayIn } from '@/lib/dates';
import { requireProfile, requireViewer } from '@/lib/viewer';

/** 次の大会がこの日数以内なら、スマホでも画面の一番上に出す */
const NEXT_MEET_ON_TOP_DAYS = 14;

/**
 * ホーム。幅 768px 以上は2列：左に種目ごとの色付きのカード、右に次の大会・コンディション・天気。
 * 今日のアドバイスと AI のメニューは分析の画面へ移した（中元さんの弟さんの要望、2026-10-18）。自分のカード（顔・名前・本数）は外した。顔と名前はユーザーメニューにあり、
 * 本数は分析で見られるため（本人、2026-10-11）。チームをコーチしている人にだけ、左の列の一番上にチームのカード
 * （選手とコーチの切り替えは置かない。本人、2026-10-14）
 */
export default async function Home() {
  const viewer = await requireViewer();
  const profile = await requireProfile(viewer.userId);
  const today = todayIn(profile.timeZone);
  const [targets, attempts, todayLog, competition, coachedTeams] = await Promise.all([
    getTargets(viewer.userId, profile.events),
    listAllAttempts(viewer.userId),
    getDayLog(viewer.userId, today),
    nextCompetition(viewer.userId, today),
    coachedTeamSummaries(viewer.userId),
  ]);
  const t = await getTranslations('home');
  const tNav = await getTranslations('nav');
  const days = competition ? daysBetween(today, competition.day) : null;
  // 大会が近いときは、スマホでも種目のカードより上に出す（起動画面の代わり。2026-10-12 に本人と決めた）
  const soon = days !== null && days <= NEXT_MEET_ON_TOP_DAYS;
  // 次の大会はアプリの青のカード。残りの日数を大きな数字で（黒は怖いと言われた。本人、2026-10-11）
  const nextCard = (
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
  );

  return (
    <main className="flex flex-col gap-3">
      <PageTitle>{tNav('home')}</PageTitle>
      {soon && <div className="contents md:hidden">{nextCard}</div>}

      <div className={MAIN_SIDE}>
        <div className="flex flex-col gap-3">
          {/* チームをコーチしている人にだけ、種目のカードの上にチームのカード（2026-10-14） */}
          <TeamsCard teams={coachedTeams} />
          {profile.events.map((event) => {
            const target = targets.get(event)!;
            return (
              <EventHero
                key={event}
                event={event}
                goalM={target.seasonGoalM}
                bests={eventBests(attempts, event, target, today, profile.seasonStartMonth)}
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
          {soon ? <div className="hidden md:contents">{nextCard}</div> : nextCard}
          {/* 今日のコンディション。押すと直す画面へ移り、保存したらホームへ戻る */}
          <ConditionCard
            log={todayLog}
            editHref="/log/today/condition?from=home"
            title={t('todayCondition')}
            units={profile.units}
          />
          <WeatherCard />
        </div>
      </div>
    </main>
  );
}
