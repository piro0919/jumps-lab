import { redirect } from 'next/navigation';
import { getFormatter, getTranslations } from 'next-intl/server';
import { AttemptsCard } from '@/components/attempts-card';
import { ConditionCard } from '@/components/condition-card';
import { PageTitle, HALVES } from '@/components/layout-ui';
import { getDayLog, listAttemptsBetween } from '@/lib/data';
import { resolveLogDay, todayIn } from '@/lib/dates';
import { requireProfile, requireViewer } from '@/lib/viewer';

/**
 * 1日分の試技と体調。/log/today は本人の時間帯での今日を開く。
 * 先の日は記録できないので今日へ送る（日付の形でないものも同じ）。この画面は見るだけで、
 * 試技を足すのは /log/[day]/new、コンディションを直すのは /log/[day]/condition
 */
export default async function LogDay({ params }: PageProps<'/log/[day]'>) {
  const viewer = await requireViewer();
  const profile = await requireProfile(viewer.userId);
  const today = todayIn(profile.timeZone);
  const day = resolveLogDay((await params).day, today);
  if (!day) redirect('/log/today');

  const [log, attempts] = await Promise.all([
    getDayLog(viewer.userId, day),
    listAttemptsBetween(viewer.userId, day, day),
  ]);
  const t = await getTranslations('log');
  const tNav = await getTranslations('nav');
  const format = await getFormatter();

  return (
    <main className="flex flex-col gap-3">
      <PageTitle back={{ href: '/log', label: tNav('backTo', { page: tNav('log') }) }}>
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
      <div className={HALVES}>
        <AttemptsCard day={day} units={profile.units} attempts={attempts} events={profile.events} />
        <ConditionCard log={log} editHref={`/log/${day}/condition`} />
      </div>
    </main>
  );
}
