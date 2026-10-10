import { ChevronRight, Plus } from 'lucide-react';
import Link from 'next/link';
import { getFormatter, getTranslations } from 'next-intl/server';
import { Card, PageTitle } from '@/components/layout-ui';
import { LogCalendar } from '@/components/log-calendar';
import { getProfile, listAllAttempts, listDayLogs } from '@/lib/data';
import { todayIn } from '@/lib/dates';
import { buildLogDays } from '@/lib/log-days';
import { formatMark } from '@/lib/units';
import { requireViewer } from '@/lib/viewer';

/**
 * 記録の一覧。記録か体調のある日を新しい日から並べ、押すとその日を開く（Strong の履歴と同じ形）。
 * ?view=calendar で同じ日々をカレンダーの形で見る（?month=YYYY-MM で月を選ぶ）
 */
export default async function Log({ searchParams }: PageProps<'/log'>) {
  const viewer = await requireViewer();
  const profile = (await getProfile(viewer.userId))!;
  const today = todayIn(profile.timeZone);
  const params = await searchParams;
  const calendar = params.view === 'calendar';
  const month =
    typeof params.month === 'string' && /^\d{4}-\d{2}$/.test(params.month)
      ? params.month
      : today.slice(0, 7);

  const [attempts, logs] = await Promise.all([
    listAllAttempts(viewer.userId),
    listDayLogs(viewer.userId),
  ]);
  const days = buildLogDays(attempts, logs);
  const t = await getTranslations('log');
  const tNav = await getTranslations('nav');
  const tEvents = await getTranslations('events');
  const format = await getFormatter();

  const tab = (active: boolean) =>
    `flex h-8 items-center rounded-lg px-3 text-sm font-semibold ${
      active ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'
    }`;

  return (
    <main className="flex flex-col gap-3">
      <PageTitle
        action={
          <Link
            href="/log/today"
            className="inline-flex h-9 items-center gap-1 rounded-full bg-primary px-3.5 text-sm font-semibold text-primary-foreground"
          >
            <Plus aria-hidden className="size-4" />
            {t('recordToday')}
          </Link>
        }
      >
        {tNav('log')}
      </PageTitle>

      <nav className="mx-4 flex w-fit gap-1 rounded-xl bg-muted p-1">
        <Link href="/log" aria-current={calendar ? undefined : 'page'} className={tab(!calendar)}>
          {t('list')}
        </Link>
        <Link
          href="/log?view=calendar"
          aria-current={calendar ? 'page' : undefined}
          className={tab(calendar)}
        >
          {t('calendar')}
        </Link>
      </nav>

      {calendar ? (
        <div className="lg:max-w-md">
          <LogCalendar month={month} today={today} recorded={new Set(days.map((d) => d.day))} />
        </div>
      ) : days.length === 0 ? (
        <Card>
          <p className="text-sm text-muted-foreground">{t('empty')}</p>
        </Card>
      ) : (
        <Card className="p-0">
          <ul className="flex flex-col divide-y divide-border">
            {days.map((entry) => (
              <li key={entry.day}>
                <Link
                  href={`/log/${entry.day}`}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-accent"
                >
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="font-semibold">
                      {entry.day === today
                        ? t('today')
                        : format.dateTime(new Date(`${entry.day}T00:00:00Z`), {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                            weekday: 'short',
                            timeZone: 'UTC',
                          })}
                    </span>
                    <span className="truncate text-sm text-muted-foreground">
                      {[
                        ...entry.events.map((e) =>
                          t('eventSummary', {
                            event: tEvents(e.event),
                            mark: formatMark(e.bestM, profile.units),
                            count: e.count,
                          }),
                        ),
                        entry.condition !== null && t('condition', { value: entry.condition }),
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </span>
                  </span>
                  <ChevronRight aria-hidden className="size-4 shrink-0 text-muted-foreground" />
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </main>
  );
}
