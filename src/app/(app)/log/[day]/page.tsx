import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getFormatter, getTranslations } from 'next-intl/server';
import { AttemptsCard } from '@/components/attempts-card';
import { CommentThread } from '@/components/comment-thread';
import { ConditionCard } from '@/components/condition-card';
import { PageTitle, HALVES } from '@/components/layout-ui';
import { buttonVariants } from '@/components/ui/button';
import { VideosCard } from '@/components/videos-card';
import { commentOpen, toCommentItem } from '@/lib/comments';
import {
  getDayLog,
  hasMenu,
  listAttemptsBetween,
  listDayComments,
  listMemberships,
  listVideosOnDay,
} from '@/lib/data';
import { resolveLogDay, todayIn } from '@/lib/dates';
import { downloadUrl, viewUrl } from '@/lib/r2';
import { formatMark } from '@/lib/units';
import { requireProfile, requireViewer } from '@/lib/viewer';

/**
 * 1日分の試技と体調と動画。/log/today は本人の時間帯での今日を開く。
 * 先の日は記録できないので今日へ送る（日付の形でないものも同じ）。この画面は見るだけで、
 * 試技を足すのは /log/[day]/new、コンディションを直すのは /log/[day]/condition。
 * チームに入っていれば、チームごとにコーチとのコメントのやりとりを出す（書けるのは直近14日の日だけ）。
 * 抜けたチームのやりとりは見るだけで残す
 */
export default async function LogDay({ params }: PageProps<'/log/[day]'>) {
  const viewer = await requireViewer();
  const profile = await requireProfile(viewer.userId);
  const today = todayIn(profile.timeZone);
  const day = resolveLogDay((await params).day, today);
  if (!day) redirect('/log/today');

  const [log, attempts, videos, menuMade, comments, memberships] = await Promise.all([
    getDayLog(viewer.userId, day),
    listAttemptsBetween(viewer.userId, day, day),
    listVideosOnDay(viewer.userId, day),
    hasMenu(viewer.userId, day),
    listDayComments(viewer.userId, day),
    listMemberships(viewer.userId),
  ]);
  // やりとりはチームごと。いま入っているチーム（入った順）のあとに、抜けたチームのやりとりを見るだけで並べる
  const open = commentOpen(day, today);
  const commented = new Set(comments.map((c) => c.teamId));
  const current = new Set(memberships.map((team) => team.id));
  const threads = [
    ...memberships.map((team) => ({ teamId: team.id, name: team.name, current: true })),
    ...[...new Map(comments.map((c) => [c.teamId, c.teamName])).entries()]
      .filter(([teamId]) => !current.has(teamId))
      .map(([teamId, name]) => ({ teamId, name, current: false })),
  ]
    // 書けない日（14日より前）は、やりとりのあるチームだけ
    .filter((thread) => (thread.current && open) || commented.has(thread.teamId));
  // 動画は開くたびに期限つきの URL（見る用と保存する用）を作る。結び付けた試技は「2. 6.12 m」のように、試技の欄と同じ番号で出す
  const videoItems = await Promise.all(
    videos.map(async (video) => {
      // 見る用と保存する用の URL は、並べて作る
      const [url, saveUrl] = await Promise.all([
        viewUrl(video.objectKey),
        // 保存する名前は日付と種目（元のファイル名は IMG_1234 のようなもので、持っていない）
        downloadUrl(
          video.objectKey,
          `jumps-lab-${video.day}-${video.event}${video.objectKey.slice(video.objectKey.lastIndexOf('.'))}`,
        ),
      ]);
      const sameEvent = attempts.filter((a) => a.event === video.event);
      const index = sameEvent.findIndex((a) => a.id === video.attemptId);
      return {
        id: video.id,
        event: video.event,
        kind: video.kind,
        note: video.note,
        url,
        downloadUrl: saveUrl,
        expiresAt: video.expiresAt,
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
  const tMenu = await getTranslations('menu');
  const tComments = await getTranslations('comments');
  const format = await getFormatter();

  return (
    <main className="flex flex-col gap-3">
      <PageTitle
        back={{ href: '/log', label: tNav('backTo', { page: tNav('log') }) }}
        action={
          // AI が作ったその日のメニュー（作った日だけ）
          menuMade ? (
            <Link
              href={`${base}/menu`}
              className={buttonVariants({ variant: 'secondary', size: 'sm' })}
            >
              {tMenu('short')}
            </Link>
          ) : undefined
        }
      >
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
        <VideosCard
          addHref={`${base}/videos/new`}
          videos={videoItems}
          timeZone={profile.timeZone}
        />
        {threads.length > 0 && (
          <div id="comments" className="flex scroll-mt-20 flex-col gap-3">
            {threads.map((thread) => (
              <CommentThread
                key={thread.teamId}
                title={tComments('titleTeam', { team: thread.name })}
                timeZone={profile.timeZone}
                comments={comments
                  .filter((c) => c.teamId === thread.teamId)
                  .map((c) => toCommentItem(c, viewer.userId))}
                form={thread.current && open ? { teamId: thread.teamId, day } : null}
              />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
