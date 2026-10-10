import { ChevronLeft } from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getFormatter, getTranslations } from 'next-intl/server';
import { AttemptsCard } from '@/components/attempts-card';
import { DayLogForm } from '@/components/day-log-form';
import { EventSwitcher } from '@/components/event-switcher';
import { PageTitle } from '@/components/layout-ui';
import { getDayLog, getProfile, listAttemptsBetween } from '@/lib/data';
import { todayIn } from '@/lib/dates';
import { requireViewer } from '@/lib/viewer';

/**
 * 1日分の記録と体調。/log/today は本人の時間帯での今日を開く。
 * 先の日は記録できないので今日へ送る（日付の形でないものも同じ）
 */
export default async function LogDay({ params }: PageProps<'/log/[day]'>) {
  const viewer = await requireViewer();
  const profile = (await getProfile(viewer.userId))!;
  const today = todayIn(profile.timeZone);
  const { day: requested } = await params;
  if (requested !== 'today' && (!/^\d{4}-\d{2}-\d{2}$/.test(requested) || requested > today)) {
    redirect('/log/today');
  }
  const day = requested === 'today' ? today : requested;

  const [log, attempts] = await Promise.all([
    getDayLog(viewer.userId, day),
    listAttemptsBetween(viewer.userId, day, day),
  ]);
  const t = await getTranslations('log');
  const tNav = await getTranslations('nav');
  const format = await getFormatter();

  return (
    <main className="flex flex-col gap-3">
      <Link
        href="/log"
        className="-mb-4 flex w-fit items-center gap-0.5 px-3 pt-4 text-sm font-medium text-primary"
      >
        <ChevronLeft aria-hidden className="size-4" />
        {tNav('log')}
      </Link>
      <PageTitle action={<EventSwitcher events={profile.events} current={profile.currentEvent} />}>
        {day === today
          ? t('today')
          : format.dateTime(new Date(`${day}T00:00:00Z`), {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
              weekday: 'short',
              timeZone: 'UTC',
            })}
      </PageTitle>
      <div className="flex flex-col gap-3 lg:grid lg:grid-cols-2 lg:items-start">
        <AttemptsCard
          day={day}
          event={profile.currentEvent}
          units={profile.units}
          attempts={attempts.filter((a) => a.event === profile.currentEvent)}
        />
        <DayLogForm day={day} log={log} />
      </div>
    </main>
  );
}
