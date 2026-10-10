'use client';

import { Pencil, Plus, Trash2, Video } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useState, useTransition } from 'react';
import { deleteAttemptAction } from '@/app/actions/today';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { Badge, Card, CardTitle, DisplayNumber, EmptyState } from '@/components/layout-ui';
import { Button, buttonVariants } from '@/components/ui/button';
import type { Attempt } from '@/lib/data';
import { EVENT_BG, isWindAided, type JumpEvent } from '@/lib/events';
import { formatMark, type Units } from '@/lib/units';

/**
 * その日の記録。種目ごとにまとめて1本ずつ並べ、種目ごとにいちばん良い1本に印を付ける。
 * 並びは本人の選んだ種目の順。種目から外した種目の記録も消さずに後ろに出す。
 * 足すのは別の画面（/log/[day]/new）、削除は確かめてから
 */
export function AttemptsCard({
  day,
  events,
  units,
  attempts,
  videos = {},
  sample = false,
}: {
  day: string;
  /** 本人の選んだ種目 */
  events: JumpEvent[];
  units: Units;
  /** その日の記録（全種目）。古い順 */
  attempts: Attempt[];
  /** 動画を結び付けた試技（試技の id から動画の id）。行に動画への印を出す */
  videos?: Record<string, string>;
  /** LP の見本。リンクの先読みをしない（押せない枠の中でも、Next は画面に入ったリンクを先読みする） */
  sample?: boolean;
}) {
  const t = useTranslations('today');
  const tEvents = useTranslations('events');
  const tVideos = useTranslations('videos');
  // 消す前に確かめている記録
  const [removing, setRemoving] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const shown = [
    ...events,
    ...new Set(attempts.map((a) => a.event).filter((e) => !events.includes(e))),
  ];
  const groups = shown
    .map((event) => ({ event, rows: attempts.filter((a) => a.event === event) }))
    .filter((group) => group.rows.length > 0);

  return (
    <Card>
      {/* 空のときは題の横の追加を出さず、空の文の下のボタンだけにする（2つ並ばないように） */}
      <CardTitle
        action={
          groups.length === 0 ? undefined : (
            <Link
              href={`/log/${day}/new`}
              prefetch={sample ? false : undefined}
              className={buttonVariants({ size: 'sm' })}
            >
              <Plus aria-hidden className="size-4" />
              {t('add')}
            </Link>
          )
        }
      >
        {t('attempts')}
      </CardTitle>
      {groups.length === 0 ? (
        <EmptyState
          message={t('noAttempts')}
          action={{ href: `/log/${day}/new`, label: t('addAttempt') }}
        />
      ) : (
        <div className="flex flex-col gap-4">
          {groups.map(({ event, rows }) => {
            const best = Math.max(...rows.map((r) => r.markM));
            return (
              <section key={event}>
                <h3 className="flex">
                  <Badge tone="solid" className={EVENT_BG[event]}>
                    {tEvents(event)}
                  </Badge>
                </h3>
                <ol className="flex flex-col divide-y divide-border">
                  {rows.map((attempt, index) => (
                    <li key={attempt.id} className="flex items-center gap-3 py-2.5">
                      <span className="w-5 text-sm text-muted-foreground tabular-nums">
                        {index + 1}
                      </span>
                      <span className="flex min-w-0 flex-1 flex-col">
                        {/* 数字は折らず、入りきらない札を次の行へ回す（「ベスト」と「追い風参考」が並ぶと、
                            幅 375px で m が次の行に落ち、札が鉛筆に重なった。2026-10-11） */}
                        <span className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                          <DisplayNumber size="md" className="whitespace-nowrap">
                            {formatMark(attempt.markM, units)}
                          </DisplayNumber>
                          {attempt.markM === best && (
                            <Badge tone="solid" className={EVENT_BG[event]}>
                              {t('best')}
                            </Badge>
                          )}
                          {/* 追い風 2.0 m/s 超え。PB・SB には数えていない */}
                          {isWindAided(attempt.windMs) && (
                            <Badge tone="neutral">{t('windAided')}</Badge>
                          )}
                          {/* 結び付けた動画へ。同じ画面の動画の欄まで飛ぶ */}
                          {videos[attempt.id] && (
                            <a
                              href={`#video-${videos[attempt.id]}`}
                              aria-label={tVideos('play')}
                              className="self-center text-muted-foreground hover:text-foreground"
                            >
                              <Video aria-hidden className="size-4" />
                            </a>
                          )}
                        </span>
                        <span className="truncate text-xs text-muted-foreground">
                          {[
                            t(attempt.kind),
                            attempt.windMs === null
                              ? null
                              : `${attempt.windMs > 0 ? '+' : ''}${attempt.windMs.toFixed(1)} m/s`,
                            attempt.note,
                          ]
                            .filter(Boolean)
                            .join(' · ')}
                        </span>
                      </span>
                      {/* 行の操作はアイコンだけのボタン（大会の一覧と同じ）。直すのは別の画面 */}
                      <Link
                        href={`/attempts/${attempt.id}/edit`}
                        prefetch={sample ? false : undefined}
                        aria-label={t('editAttempt')}
                        className={buttonVariants({ variant: 'ghost', size: 'icon' })}
                      >
                        <Pencil aria-hidden />
                      </Link>
                      <Button
                        variant="ghost"
                        size="icon"
                        type="button"
                        aria-label={t('delete')}
                        onClick={() => setRemoving(attempt.id)}
                      >
                        <Trash2 aria-hidden />
                      </Button>
                    </li>
                  ))}
                </ol>
              </section>
            );
          })}
        </div>
      )}

      <ConfirmDialog
        open={removing !== null}
        title={t('deleteConfirm')}
        onOpenChange={(open) => {
          if (!open) setRemoving(null);
        }}
        onConfirm={() => {
          const id = removing;
          if (id) startTransition(() => deleteAttemptAction(id));
        }}
      />
    </Card>
  );
}
