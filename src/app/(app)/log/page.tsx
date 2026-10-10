import { ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { getFormatter, getTranslations } from 'next-intl/server';
import { Card, PageTitle, SEGMENTS, Stat, segmentClass, EmptyState } from '@/components/layout-ui';
import { LogCalendar } from '@/components/log-calendar';
import { listAllAttempts, listDayLogs } from '@/lib/data';
import { EVENT_TEXT } from '@/lib/events';
import { ISO_MONTH_END, isMonth, todayIn } from '@/lib/dates';
import { buildLogDays } from '@/lib/log-days';
import { formatMarkParts } from '@/lib/units';
import { requireProfile, requireViewer } from '@/lib/viewer';

/**
 * 記録の一覧。記録か体調のある日を新しい日から並べ、押すとその日を開く（Strong の履歴と同じ形）。
 * ?view=calendar で同じ日々をカレンダーの形で見る（?month=YYYY-MM で月を選ぶ）
 */
export default async function Log({ searchParams }: PageProps<'/log'>) {
  const viewer = await requireViewer();
  const profile = await requireProfile(viewer.userId);
  const today = todayIn(profile.timeZone);
  const params = await searchParams;
  const calendar = params.view === 'calendar';
  const month =
    typeof params.month === 'string' && isMonth(params.month)
      ? params.month
      : today.slice(0, ISO_MONTH_END);

  const [attempts, logs] = await Promise.all([
    listAllAttempts(viewer.userId),
    listDayLogs(viewer.userId),
  ]);
  const days = buildLogDays(attempts, logs);
  const t = await getTranslations('log');
  const tNav = await getTranslations('nav');
  const tEvents = await getTranslations('events');
  const format = await getFormatter();

  return (
    <main className="flex flex-col gap-3">
      <PageTitle>{tNav('log')}</PageTitle>

      <nav className={`mx-4 ${SEGMENTS}`}>
        <Link
          href="/log"
          aria-current={calendar ? undefined : 'page'}
          className={segmentClass(!calendar)}
        >
          {t('list')}
        </Link>
        <Link
          href="/log?view=calendar"
          aria-current={calendar ? 'page' : undefined}
          className={segmentClass(calendar)}
        >
          {t('calendar')}
        </Link>
      </nav>

      {calendar ? (
        <LogCalendar
          month={month}
          today={today}
          recorded={new Set(days.map((d) => d.day))}
          weekStart={profile.weekStart}
        />
      ) : days.length === 0 ? (
        <Card>
          <EmptyState
            message={t('empty')}
            action={{ href: '/log/today/new', label: t('recordToday') }}
          />
        </Card>
      ) : (
        <ul className="flex flex-col gap-3 lg:grid lg:grid-cols-2">
          {days.map((entry) => (
            <li key={entry.day}>
              <Link href={`/log/${entry.day}`} className="block">
                <Card className="flex flex-col gap-3 hover:bg-accent/40">
                  <span className="flex items-center justify-between text-sm font-semibold text-muted-foreground">
                    {entry.day === today
                      ? t('today')
                      : format.dateTime(new Date(`${entry.day}T00:00:00Z`), {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                          weekday: 'short',
                          timeZone: 'UTC',
                        })}
                    <ChevronRight aria-hidden className="size-4" />
                  </span>
                  <div className="flex flex-wrap gap-x-6 gap-y-3">
                    {entry.events.map((e) => (
                      <Stat
                        key={e.event}
                        size="md"
                        color={EVENT_TEXT[e.event]}
                        value={formatMarkParts(e.bestM, profile.units)}
                        label={t('eventLabel', { event: tEvents(e.event), count: e.count })}
                      />
                    ))}
                    {entry.condition !== null && (
                      <Stat size="md" value={`${entry.condition}/10`} label={t('conditionLabel')} />
                    )}
                  </div>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
