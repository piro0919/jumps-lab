import { redirect } from 'next/navigation';
import { getFormatter, getTranslations } from 'next-intl/server';
import { DayLogForm } from '@/components/day-log-form';
import { BackLink, Card, PageTitle } from '@/components/layout-ui';
import { getDayLog, getProfile } from '@/lib/data';
import { resolveLogDay, todayIn } from '@/lib/dates';
import { requireViewer } from '@/lib/viewer';

/** その日のコンディションと練習メモを直す画面。日の画面の「編集」から来る。先の日と実在しない日は今日へ送る */
export default async function EditCondition({
  params,
  searchParams,
}: PageProps<'/log/[day]/condition'>) {
  const viewer = await requireViewer();
  const profile = (await getProfile(viewer.userId))!;
  const today = todayIn(profile.timeZone);
  const requested = (await params).day;
  const day = resolveLogDay(requested, today);
  if (!day) redirect('/log/today/condition');

  const log = await getDayLog(viewer.userId, day);
  const t = await getTranslations('today');
  const tLog = await getTranslations('log');
  const format = await getFormatter();
  // ホームの「今日のコンディション」から来たら（?from=home）、ホームへ戻る
  const fromHome = (await searchParams).from === 'home';
  const tNav = await getTranslations('nav');
  const backHref = fromHome ? '/' : `/log/${requested === 'today' ? 'today' : day}`;
  const dayLabel = fromHome
    ? tNav('home')
    : day === today
      ? tLog('today')
      : format.dateTime(new Date(`${day}T00:00:00Z`), {
          month: 'short',
          day: 'numeric',
          weekday: 'short',
          timeZone: 'UTC',
        });

  return (
    <main className="flex flex-col gap-3 lg:mx-auto lg:w-full lg:max-w-xl">
      <BackLink href={backHref}>{dayLabel}</BackLink>
      {/* まだ入れていない日は「入力」、入れてある日は「編集」（ホームのボタンの「入力する」と合わせる） */}
      <PageTitle>{t(log ? 'editCondition' : 'newCondition')}</PageTitle>
      <Card>
        <DayLogForm day={day} log={log} backHref={backHref} />
      </Card>
    </main>
  );
}
