import { ChevronLeft, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { getFormatter, getTranslations } from 'next-intl/server';
import { DayPanel } from '@/components/day-panel';
import { Card, PageTitle } from '@/components/ui';
import { getProfile, listAttemptsBetween, listCompetitionsBetween } from '@/lib/data';
import { todayIn } from '@/lib/dates';
import { requireViewer } from '@/lib/viewer';

const isDay = (value: unknown): value is string =>
  typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);

/** YYYY-MM の月を n か月ずらす */
function shiftMonth(month: string, n: number): string {
  const date = new Date(`${month}-01T00:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() + n);
  return date.toISOString().slice(0, 7);
}

/**
 * 月の表と、選んだ日の中身。?day= で日を選ぶ（月はその日の月）。
 * 週は日曜から（プロトタイプと同じ）
 */
export default async function Calendar({ searchParams }: PageProps<'/calendar'>) {
  const viewer = await requireViewer();
  const profile = (await getProfile(viewer.userId))!;
  const today = todayIn(profile.timeZone);
  const params = await searchParams;
  const day = isDay(params.day) ? params.day : today;
  const month = day.slice(0, 7);

  const first = `${month}-01`;
  const daysInMonth = new Date(
    Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0),
  ).getUTCDate();
  const last = `${month}-${String(daysInMonth).padStart(2, '0')}`;
  const leading = new Date(`${first}T00:00:00Z`).getUTCDay();

  const [attempts, competitions] = await Promise.all([
    listAttemptsBetween(viewer.userId, first, last),
    listCompetitionsBetween(viewer.userId, first, last),
  ]);
  const t = await getTranslations('calendar');
  const tNav = await getTranslations('nav');
  const format = await getFormatter();
  const utc = (d: string) => new Date(`${d}T00:00:00Z`);

  const weekdays = Array.from({ length: 7 }, (_, i) =>
    format.dateTime(utc(`2026-10-${String(11 + i).padStart(2, '0')}`), {
      weekday: 'narrow',
      timeZone: 'UTC',
    }),
  );
  const cells = [
    ...Array.from({ length: leading }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => `${month}-${String(i + 1).padStart(2, '0')}`),
  ];
  const withAttempts = new Set(attempts.map((a) => a.day));
  const withCompetitions = new Set(competitions.map((c) => c.day));

  return (
    <main className="flex flex-col gap-3">
      <PageTitle>{tNav('calendar')}</PageTitle>

      <div className="flex flex-col gap-3 lg:grid lg:grid-cols-2 lg:items-start">
        <Card>
          <div className="mb-3 flex items-center justify-between">
            <Link
              href={`/calendar?day=${shiftMonth(month, -1)}-01`}
              aria-label={t('previous')}
              className="flex size-9 items-center justify-center rounded-full bg-field"
            >
              <ChevronLeft aria-hidden className="size-5" />
            </Link>
            <span className="text-[17px] font-bold">
              {format.dateTime(utc(first), { year: 'numeric', month: 'long', timeZone: 'UTC' })}
            </span>
            <Link
              href={`/calendar?day=${shiftMonth(month, 1)}-01`}
              aria-label={t('next')}
              className="flex size-9 items-center justify-center rounded-full bg-field"
            >
              <ChevronRight aria-hidden className="size-5" />
            </Link>
          </div>
          <div className="grid grid-cols-7 text-center text-xs font-medium text-sub">
            {weekdays.map((weekday, i) => (
              <span key={i} className="py-1">
                {weekday}
              </span>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {cells.map((cell, i) =>
              cell === null ? (
                <span key={`blank-${i}`} />
              ) : (
                <Link
                  key={cell}
                  href={`/calendar?day=${cell}`}
                  aria-current={cell === day ? 'date' : undefined}
                  className={`flex h-12 flex-col items-center justify-center gap-1 rounded-xl text-[15px] tabular-nums ${
                    cell === day
                      ? 'bg-accent font-bold text-white'
                      : cell === today
                        ? 'font-bold text-accent'
                        : ''
                  }`}
                >
                  {Number(cell.slice(8))}
                  <span className="flex h-1.5 gap-0.5">
                    {withCompetitions.has(cell) && (
                      <span
                        className={`size-1.5 rounded-full ${cell === day ? 'bg-white' : 'bg-danger'}`}
                      />
                    )}
                    {withAttempts.has(cell) && (
                      <span
                        className={`size-1.5 rounded-full ${cell === day ? 'bg-white' : 'bg-accent'}`}
                      />
                    )}
                  </span>
                </Link>
              ),
            )}
          </div>
        </Card>

        <div className="flex flex-col gap-3">
          <DayPanel
            key={day}
            day={day}
            title={format.dateTime(utc(day), {
              month: 'long',
              day: 'numeric',
              weekday: 'short',
              timeZone: 'UTC',
            })}
            canOpenDay={day <= today}
            attempts={attempts.filter((a) => a.day === day)}
            competitions={competitions.filter((c) => c.day === day)}
            units={profile.units}
          />
        </div>
      </div>
    </main>
  );
}
