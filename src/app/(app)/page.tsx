import { ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Badge,
  Card,
  DisplayNumber,
  PageTitle,
  SectionTitle,
  Stat,
  Watermark,
} from '@/components/layout-ui';
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
      <Watermark>{EVENT_MARK[event]}</Watermark>
      <div className="relative flex flex-col gap-4">
        <SectionTitle inverse>{tEvents(event)}</SectionTitle>
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
          <Badge tone="inverse">
            {gap <= 0 ? t('goalReached') : t('toGoal', { distance: formatMark(gap, units) })}
          </Badge>
        )}
      </div>
    </section>
  );
}

/**
 * 自分のカード（手本の Strava のホームの左の列）。顔・名前・種目と、跳んだ本数・記録した日の数。
 * 幅 1024px 以上だけに出す
 */
async function ProfileCard({
  name,
  image,
  events,
  jumps,
  daysLogged,
}: {
  name: string;
  image: string | null;
  events: JumpEvent[];
  jumps: number;
  daysLogged: number;
}) {
  const t = await getTranslations('home');
  const tEvents = await getTranslations('events');

  return (
    <Card className="flex flex-col items-center gap-4 text-center">
      <Avatar className="size-20">
        {image && <AvatarImage src={image} alt="" referrerPolicy="no-referrer" />}
        <AvatarFallback>{name.slice(0, 1).toUpperCase()}</AvatarFallback>
      </Avatar>
      <SectionTitle>{name}</SectionTitle>
      <div className="flex flex-wrap justify-center gap-1.5">
        {events.map((event) => (
          <Badge key={event} tone="solid" className={EVENT_BG[event]}>
            {tEvents(event)}
          </Badge>
        ))}
      </div>
      <div className="grid w-full grid-cols-2 gap-2 border-t border-border pt-4">
        <Stat size="sm" value={jumps} label={t('jumps')} />
        <Stat size="sm" value={daysLogged} label={t('daysLogged')} />
      </div>
    </Card>
  );
}

/**
 * ホーム。幅 1024px 以上は3列（手本の Strava のホーム）：左に自分のカード、真ん中に種目ごとの色付きのカード、
 * 右に次の大会と天気。スマホは種目のカードから縦に積む
 */
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
  const days = competition ? daysBetween(today, competition.day) : null;

  return (
    <main className="flex flex-col gap-3">
      <PageTitle>{tNav('home')}</PageTitle>

      <div className="flex flex-col gap-3 lg:grid lg:grid-cols-[17rem_1fr_19rem] lg:items-start">
        <div className="hidden lg:block">
          <ProfileCard
            name={profile.name}
            image={viewer.image}
            events={profile.events}
            jumps={attempts.length}
            daysLogged={new Set(attempts.map((a) => a.day)).size}
          />
        </div>
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
          <WeatherCard />
        </div>
      </div>
    </main>
  );
}
