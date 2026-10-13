import { ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getFormatter, getTranslations } from 'next-intl/server';
import { z } from 'zod';
import { Badge, Card, CardTitle, EmptyState, PageTitle } from '@/components/layout-ui';
import { buttonVariants } from '@/components/ui/button';
import { VideoCompare, type CompareVideo } from '@/components/video-compare';
import { getVideo, listComparableVideos, type Video } from '@/lib/data';
import { todayIn } from '@/lib/dates';
import { EVENT_BG } from '@/lib/events';
import { viewUrl } from '@/lib/r2';
import { requireProfile, requireViewer } from '@/lib/viewer';

/** クエリの id を1つだけ取り出す（?a=x&a=y のような重なりは受けない） */
function idOf(value: string | string[] | undefined): string | null {
  return typeof value === 'string' && z.uuid().safeParse(value).success ? value : null;
}

/**
 * 2本の動画を見比べる画面（?a=<動画>&b=<動画>）。日の画面の動画の行から a だけを付けて来て、
 * b が無ければ、見比べる相手を本人の同じ種目のほかの動画から選ぶ（新しい順）。
 * どちらの id も、本人の届いた・期限の過ぎていない動画で、同じ種目でなければ開かない。
 * 見るための URL は、日の画面と同じく開くたびに作る期限つきの署名 URL
 */
export default async function CompareVideos({ searchParams }: PageProps<'/videos/compare'>) {
  const viewer = await requireViewer();
  const params = await searchParams;
  const aId = idOf(params.a);
  const bId = params.b === undefined ? null : idOf(params.b);
  if (!aId || (params.b !== undefined && (!bId || bId === aId))) notFound();
  const [profile, a, b] = await Promise.all([
    requireProfile(viewer.userId),
    getVideo(viewer.userId, aId),
    bId ? getVideo(viewer.userId, bId) : null,
  ]);
  if (!a || (bId && (!b || b.event !== a.event))) notFound();

  const today = todayIn(profile.timeZone);
  const t = await getTranslations('compare');
  const tToday = await getTranslations('today');
  const tEvents = await getTranslations('events');
  const tNav = await getTranslations('nav');
  const tLog = await getTranslations('log');
  const format = await getFormatter();
  const dayLabel = (day: string) =>
    day === today
      ? tLog('today')
      : format.dateTime(new Date(`${day}T00:00:00Z`), {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
          timeZone: 'UTC',
        });
  const detail = (video: Video) => [tToday(video.kind), video.note].filter(Boolean).join(' · ');
  const back = {
    href: `/log/${a.day === today ? 'today' : a.day}#video-${a.id}`,
    label: tNav('backTo', { page: dayLabel(a.day) }),
  };

  if (!b) {
    const others = await listComparableVideos(viewer.userId, a.event, a.id);
    return (
      <main className="flex flex-col gap-3">
        <PageTitle back={back}>{t('title')}</PageTitle>
        <Card>
          <CardTitle>{t('pick')}</CardTitle>
          {others.length === 0 ? (
            <EmptyState message={t('none', { event: tEvents(a.event) })} />
          ) : (
            <ul className="flex flex-col divide-y divide-border">
              {others.map((video) => (
                <li key={video.id}>
                  <Link
                    href={`/videos/compare?a=${a.id}&b=${video.id}`}
                    className="flex items-center gap-3 py-3"
                  >
                    <span className="flex min-w-0 flex-1 flex-col gap-1">
                      <span className="flex items-center gap-2">
                        <Badge tone="solid" className={EVENT_BG[video.event]}>
                          {tEvents(video.event)}
                        </Badge>
                        <span className="text-sm font-bold">{dayLabel(video.day)}</span>
                      </span>
                      <span className="truncate text-xs text-muted-foreground">
                        {detail(video)}
                      </span>
                    </span>
                    <ChevronRight aria-hidden className="size-4 text-muted-foreground" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </main>
    );
  }

  const [urlA, urlB] = await Promise.all([viewUrl(a.objectKey), viewUrl(b.objectKey)]);
  const item = (video: Video, url: string): CompareVideo => ({
    id: video.id,
    url,
    label: dayLabel(video.day),
    detail: detail(video),
    marks: video.marks,
  });

  return (
    <main className="flex flex-col gap-3">
      <PageTitle
        back={back}
        action={
          <Link
            href={`/videos/compare?a=${a.id}`}
            className={buttonVariants({ variant: 'secondary', size: 'sm' })}
          >
            {t('change')}
          </Link>
        }
      >
        {t('title')}
      </PageTitle>
      {/* 相手を変えたら、再生の状態を持ち越さずに作り直す */}
      <VideoCompare key={b.id} a={item(a, urlA)} b={item(b, urlB)} />
    </main>
  );
}
