import { getFormatter, getTranslations } from 'next-intl/server';
import { AttemptsCard } from '@/components/attempts-card';
import { DayLogForm } from '@/components/day-log-form';
import { EventSwitcher } from '@/components/event-switcher';
import { PageTitle } from '@/components/ui';
import { getDayLog, getProfile, listAttemptsBetween } from '@/lib/data';
import { todayIn } from '@/lib/dates';
import { requireViewer } from '@/lib/viewer';

/**
 * その日の記録。開くと今日。カレンダーから ?day= で別の日も開ける（先の日は開かない）
 */
export default async function Today({ searchParams }: PageProps<'/today'>) {
  const viewer = await requireViewer();
  const profile = (await getProfile(viewer.userId))!;
  const today = todayIn(profile.timeZone);
  const requested = (await searchParams).day;
  const day =
    typeof requested === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(requested) && requested <= today
      ? requested
      : today;

  const [log, attempts] = await Promise.all([
    getDayLog(viewer.userId, day),
    listAttemptsBetween(viewer.userId, day, day),
  ]);
  const t = await getTranslations('nav');
  const format = await getFormatter();

  return (
    <main className="flex flex-col gap-3">
      <PageTitle action={<EventSwitcher events={profile.events} current={profile.currentEvent} />}>
        {day === today
          ? t('today')
          : format.dateTime(new Date(`${day}T00:00:00Z`), {
              month: 'short',
              day: 'numeric',
              timeZone: 'UTC',
            })}
      </PageTitle>
      <AttemptsCard
        day={day}
        event={profile.currentEvent}
        units={profile.units}
        attempts={attempts.filter((a) => a.event === profile.currentEvent)}
      />
      <DayLogForm day={day} log={log} />
    </main>
  );
}
