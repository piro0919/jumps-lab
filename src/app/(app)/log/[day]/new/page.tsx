import { redirect } from 'next/navigation';
import { getFormatter, getTranslations } from 'next-intl/server';
import { AttemptForm } from '@/components/attempt-form';
import { Card, PageTitle, FORM_PAGE } from '@/components/layout-ui';
import { getDayLog, listAttemptMarksBetween } from '@/lib/data';
import { resolveLogDay, todayIn } from '@/lib/dates';
import { weatherAccess } from '@/lib/joint-use';
import { requireProfile, requireViewer } from '@/lib/viewer';

/**
 * 試技を足す画面。「今日を記録」（下のタブの真ん中とヘッダー）は /log/today/new を開く。
 * 先の日と実在しない日は今日へ送る
 */
export default async function NewAttempt({ params }: PageProps<'/log/[day]/new'>) {
  const viewer = await requireViewer();
  const profile = await requireProfile(viewer.userId);
  const today = todayIn(profile.timeZone);
  const requested = (await params).day;
  const day = resolveLogDay(requested, today);
  if (!day) redirect('/log/today/new');

  const [attempts, log] = await Promise.all([
    listAttemptMarksBetween(viewer.userId, day, day),
    getDayLog(viewer.userId, day),
  ]);
  const lastEvent = attempts.at(-1)?.event;
  const initialEvent =
    lastEvent && profile.events.includes(lastEvent) ? lastEvent : profile.events[0]!;
  const t = await getTranslations('today');
  const tNav = await getTranslations('nav');
  const tLog = await getTranslations('log');
  // 戻る先はアドレスの形のまま（今日なら /log/today）
  const backHref = `/log/${requested === 'today' ? 'today' : day}`;
  const format = await getFormatter();
  const dayLabel =
    day === today
      ? tLog('today')
      : format.dateTime(new Date(`${day}T00:00:00Z`), {
          month: 'short',
          day: 'numeric',
          weekday: 'short',
          timeZone: 'UTC',
        });

  return (
    <main className={FORM_PAGE}>
      <PageTitle back={{ href: backHref, label: tNav('backTo', { page: dayLabel }) }}>
        {t('addAttempt')}
      </PageTitle>
      <Card>
        <AttemptForm
          day={day}
          events={profile.events}
          initialEvent={initialEvent}
          units={profile.units}
          backHref={backHref}
          askCondition={log === null}
          weatherAccess={weatherAccess(profile, day, today)}
        />
      </Card>
    </main>
  );
}
