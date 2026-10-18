import { ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { getFormatter, getTranslations } from 'next-intl/server';
import {
  Badge,
  Card,
  DisplayNumber,
  PageTitle,
  SEGMENTS,
  segmentClass,
  EmptyState,
} from '@/components/layout-ui';
import { LogCalendar } from '@/components/log-calendar';
import { listAllAttempts, listCompetitions, listDayLogs, listRecentAttempts } from '@/lib/data';
import { EVENT_TEXT, formatWind, isJumpEvent, isWindAided, type JumpEvent } from '@/lib/events';
import { ISO_MONTH_END, isMonth, todayIn } from '@/lib/dates';
import { buildLogDays } from '@/lib/log-days';
import { formatMark, type Units } from '@/lib/units';
import { requireProfile, requireViewer } from '@/lib/viewer';

/** 「直近10跳躍」に並べる本数 */
const RECENT_ATTEMPTS = 10;

/**
 * 記録。既定は1種目の直近10跳躍を新しい順に並べ、押すとその日を開く。種目は ?event= で選び、
 * 無ければ本人の選んだ種目の先頭（種目を混ぜると比べられないので、種目ごと。2026-10-18）。
 * ?view=calendar で記録か体調のある日をカレンダーの形で見る（?month=YYYY-MM で月を選ぶ）。
 * 試技の無い日（体調や動画だけ）へはカレンダーから行く。
 * 大会の日は、一覧では大会名の札、カレンダーではトロフィーの印で練習の日と分ける（2026-10-15）
 */
export default async function Log({ searchParams }: PageProps<'/log'>) {
  const viewer = await requireViewer();
  const profile = await requireProfile(viewer.userId);
  const today = todayIn(profile.timeZone);
  const params = await searchParams;
  const calendar = params.view === 'calendar';
  const event =
    isJumpEvent(params.event) && profile.events.includes(params.event)
      ? params.event
      : profile.events[0]!;
  const month =
    typeof params.month === 'string' && isMonth(params.month)
      ? params.month
      : today.slice(0, ISO_MONTH_END);

  const t = await getTranslations('log');
  const tNav = await getTranslations('nav');

  return (
    <main className="flex flex-col gap-3">
      <PageTitle>{tNav('log')}</PageTitle>

      <div className="mx-4 flex flex-wrap gap-2">
        <nav className={SEGMENTS}>
          <Link
            href="/log"
            aria-current={calendar ? undefined : 'page'}
            className={segmentClass(!calendar)}
          >
            {t('recent', { count: RECENT_ATTEMPTS })}
          </Link>
          <Link
            href="/log?view=calendar"
            aria-current={calendar ? 'page' : undefined}
            className={segmentClass(calendar)}
          >
            {t('calendar')}
          </Link>
        </nav>
        {!calendar && <EventSwitch events={profile.events} current={event} />}
      </div>

      {calendar ? (
        <CalendarView
          userId={viewer.userId}
          month={month}
          today={today}
          weekStart={profile.weekStart}
        />
      ) : (
        <RecentView userId={viewer.userId} event={event} today={today} units={profile.units} />
      )}
    </main>
  );
}

/** 種目の切り替え。種目が1つだけの人には出さない */
async function EventSwitch({ events, current }: { events: JumpEvent[]; current: JumpEvent }) {
  const tEvents = await getTranslations('events');
  if (events.length < 2) return null;
  return (
    <nav className={SEGMENTS}>
      {events.map((e) => (
        <Link
          key={e}
          href={`/log?event=${e}`}
          aria-current={e === current ? 'page' : undefined}
          className={segmentClass(e === current)}
        >
          {tEvents(e)}
        </Link>
      ))}
    </nav>
  );
}

async function CalendarView({
  userId,
  month,
  today,
  weekStart,
}: {
  userId: string;
  month: string;
  today: string;
  weekStart: 0 | 1;
}) {
  const [attempts, logs, competitions] = await Promise.all([
    listAllAttempts(userId),
    listDayLogs(userId),
    listCompetitions(userId),
  ]);
  return (
    <LogCalendar
      month={month}
      today={today}
      recorded={new Set(buildLogDays(attempts, logs).map((d) => d.day))}
      competitions={new Set(competitions.map((c) => c.day))}
      weekStart={weekStart}
    />
  );
}

async function RecentView({
  userId,
  event,
  today,
  units,
}: {
  userId: string;
  event: JumpEvent;
  today: string;
  units: Units;
}) {
  const [attempts, competitions] = await Promise.all([
    listRecentAttempts(userId, event, RECENT_ATTEMPTS),
    listCompetitions(userId),
  ]);
  const t = await getTranslations('log');
  const tToday = await getTranslations('today');
  const format = await getFormatter();

  if (attempts.length === 0) {
    return (
      <Card>
        <EmptyState
          message={t('empty')}
          action={{ href: '/log/today/new', label: t('recordToday') }}
        />
      </Card>
    );
  }

  // 日ごとの大会名（同じ日に2つあれば先のもの）。大会として記録した試技にだけ札を付ける
  const competitionOn = new Map<string, string>();
  for (const competition of competitions) {
    if (!competitionOn.has(competition.day)) competitionOn.set(competition.day, competition.name);
  }

  return (
    <Card>
      <ol className="flex flex-col divide-y divide-border">
        {attempts.map((attempt) => {
          const meet = attempt.kind === 'competition' ? competitionOn.get(attempt.day) : undefined;
          return (
            <li key={attempt.id}>
              <Link
                href={`/log/${attempt.day}`}
                className="flex items-center gap-3 py-2.5 hover:bg-accent/40"
              >
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="flex min-w-0 items-center gap-2 text-xs font-semibold text-muted-foreground">
                    <span className="shrink-0">
                      {attempt.day === today
                        ? t('today')
                        : format.dateTime(new Date(`${attempt.day}T00:00:00Z`), {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                            weekday: 'short',
                            timeZone: 'UTC',
                          })}
                    </span>
                    {meet && (
                      // 長い大会名は省略する（札は縮まない inline-flex なので、縮む block に替える。2026-10-15）
                      <Badge tone="accent" className="block min-w-0 shrink truncate">
                        {meet}
                      </Badge>
                    )}
                  </span>
                  <span className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                    <DisplayNumber size="md" className={`whitespace-nowrap ${EVENT_TEXT[event]}`}>
                      {formatMark(attempt.markM, units)}
                    </DisplayNumber>
                    {/* 追い風 2.0 m/s 超え。PB・SB には数えていない */}
                    {isWindAided(attempt.windMs) && (
                      <Badge tone="neutral">{tToday('windAided')}</Badge>
                    )}
                  </span>
                  <span className="text-xs break-words text-muted-foreground">
                    {[
                      tToday(attempt.kind),
                      attempt.windMs === null ? null : formatWind(attempt.windMs),
                      attempt.note,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                </div>
                <ChevronRight aria-hidden className="size-4 shrink-0 text-muted-foreground" />
              </Link>
            </li>
          );
        })}
      </ol>
    </Card>
  );
}
