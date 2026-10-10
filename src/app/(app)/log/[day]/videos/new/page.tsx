import { redirect } from 'next/navigation';
import { getFormatter, getTranslations } from 'next-intl/server';
import { Card, PageTitle, FORM_PAGE } from '@/components/layout-ui';
import { VideoForm } from '@/components/video-form';
import { listAttemptsBetween } from '@/lib/data';
import { resolveLogDay, todayIn } from '@/lib/dates';
import { requireProfile, requireViewer } from '@/lib/viewer';

/**
 * 動画を足す画面（試技を足す画面と同じ形）。はじめの種目は、その日に最後に足した試技の種目。
 * 先の日と実在しない日は今日へ送る
 */
export default async function NewVideo({ params }: PageProps<'/log/[day]/videos/new'>) {
  const viewer = await requireViewer();
  const profile = await requireProfile(viewer.userId);
  const today = todayIn(profile.timeZone);
  const requested = (await params).day;
  const day = resolveLogDay(requested, today);
  if (!day) redirect('/log/today/videos/new');

  const attempts = await listAttemptsBetween(viewer.userId, day, day);
  const lastEvent = attempts.at(-1)?.event;
  const initialEvent =
    lastEvent && profile.events.includes(lastEvent) ? lastEvent : profile.events[0]!;
  const t = await getTranslations('videos');
  const tNav = await getTranslations('nav');
  const tLog = await getTranslations('log');
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
        {t('addVideo')}
      </PageTitle>
      <Card>
        <VideoForm
          day={day}
          events={profile.events}
          initialEvent={initialEvent}
          attempts={attempts}
          units={profile.units}
          backHref={backHref}
        />
      </Card>
    </main>
  );
}
