import { redirect } from 'next/navigation';
import { getFormatter, getTranslations } from 'next-intl/server';
import { AttemptsCard } from '@/components/attempts-card';
import { ConditionCard } from '@/components/condition-card';
import { PageTitle, HALVES } from '@/components/layout-ui';
import { VideosCard } from '@/components/videos-card';
import { getDayLog, listAttemptsBetween, listVideosOnDay } from '@/lib/data';
import { resolveLogDay, todayIn } from '@/lib/dates';
import { viewUrl } from '@/lib/r2';
import { formatMark } from '@/lib/units';
import { requireProfile, requireViewer } from '@/lib/viewer';

/**
 * 1日分の試技と体調と動画。/log/today は本人の時間帯での今日を開く。
 * 先の日は記録できないので今日へ送る（日付の形でないものも同じ）。この画面は見るだけで、
 * 試技を足すのは /log/[day]/new、コンディションを直すのは /log/[day]/condition
 */
export default async function LogDay({ params }: PageProps<'/log/[day]'>) {
  const viewer = await requireViewer();
  const profile = await requireProfile(viewer.userId);
  const today = todayIn(profile.timeZone);
  const day = resolveLogDay((await params).day, today);
  if (!day) redirect('/log/today');

  const [log, attempts, videos] = await Promise.all([
    getDayLog(viewer.userId, day),
    listAttemptsBetween(viewer.userId, day, day),
    listVideosOnDay(viewer.userId, day),
  ]);
  // 動画は開くたびに期限つきの URL を作る。結び付けた試技は「2. 6.12 m」のように、試技の欄と同じ番号で出す
  const videoItems = await Promise.all(
    videos.map(async (video) => {
      const sameEvent = attempts.filter((a) => a.event === video.event);
      const index = sameEvent.findIndex((a) => a.id === video.attemptId);
      return {
        id: video.id,
        event: video.event,
        kind: video.kind,
        note: video.note,
        url: await viewUrl(video.objectKey),
        attemptLabel:
          index < 0 ? null : `${index + 1}. ${formatMark(sameEvent[index]!.markM, profile.units)}`,
      };
    }),
  );
  const videoByAttempt = Object.fromEntries(
    videos.flatMap((v) => (v.attemptId ? [[v.attemptId, v.id]] : [])),
  );
  const base = `/log/${(await params).day === 'today' ? 'today' : day}`;
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
        <AttemptsCard
          day={day}
          units={profile.units}
          attempts={attempts}
          events={profile.events}
          videos={videoByAttempt}
        />
        <ConditionCard log={log} editHref={`/log/${day}/condition`} />
        <VideosCard addHref={`${base}/videos/new`} videos={videoItems} />
      </div>
    </main>
  );
}
