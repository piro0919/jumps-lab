'use client';

import { Plus, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useState, useTransition } from 'react';
import { deleteVideoAction } from '@/app/actions/videos';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { Badge, Card, CardTitle, EmptyState } from '@/components/layout-ui';
import { Button, buttonVariants } from '@/components/ui/button';
import { EVENT_BG, type JumpEvent } from '@/lib/events';

export type VideoItem = {
  id: string;
  event: JumpEvent;
  kind: 'practice' | 'competition';
  note: string | null;
  /** 見るための署名 URL（期限つき） */
  url: string;
  /** 結び付けた試技の記録（表示用の文字） */
  attemptLabel: string | null;
};

/**
 * その日の動画。古い順に並べ、その場で再生する（ブラウザの再生の操作をそのまま使う）。
 * 頭の1コマを見せるため、URL の末尾に #t=0.1 を付ける（iPhone は preload だけでは1コマ目を描かない）。
 * 足すのは別の画面（/log/[day]/videos/new）、削除は確かめてから
 */
export function VideosCard({ addHref, videos }: { addHref: string; videos: VideoItem[] }) {
  const t = useTranslations('videos');
  const tToday = useTranslations('today');
  const tEvents = useTranslations('events');
  const [removing, setRemoving] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  return (
    <Card>
      <CardTitle
        action={
          videos.length === 0 ? undefined : (
            <Link href={addHref} className={buttonVariants({ size: 'sm' })}>
              <Plus aria-hidden className="size-4" />
              {t('add')}
            </Link>
          )
        }
      >
        {t('title')}
      </CardTitle>
      {videos.length === 0 ? (
        <EmptyState message={t('none')} action={{ href: addHref, label: t('addVideo') }} />
      ) : (
        <ul className="flex flex-col gap-4">
          {videos.map((video) => (
            <li
              key={video.id}
              id={`video-${video.id}`}
              className="flex scroll-mt-20 flex-col gap-2"
            >
              <video
                src={`${video.url}#t=0.1`}
                controls
                playsInline
                preload="metadata"
                className="aspect-video w-full rounded-2xl bg-muted object-contain"
              />
              <div className="flex items-start gap-3">
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <Badge tone="solid" className={EVENT_BG[video.event]}>
                      {tEvents(video.event)}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {[tToday(video.kind), video.attemptLabel].filter(Boolean).join(' · ')}
                    </span>
                  </span>
                  {video.note && <p className="text-sm whitespace-pre-wrap">{video.note}</p>}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  type="button"
                  aria-label={t('delete')}
                  onClick={() => setRemoving(video.id)}
                >
                  <Trash2 aria-hidden />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={removing !== null}
        title={t('deleteConfirm')}
        onOpenChange={(open) => {
          if (!open) setRemoving(null);
        }}
        onConfirm={() => {
          const id = removing;
          if (id) startTransition(() => deleteVideoAction(id));
        }}
      />
    </Card>
  );
}
