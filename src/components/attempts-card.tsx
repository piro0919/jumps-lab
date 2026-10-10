'use client';

import { Plus, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useState, useTransition } from 'react';
import { deleteAttemptAction } from '@/app/actions/today';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { Badge, Card, CardTitle, DisplayNumber } from '@/components/layout-ui';
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
}: {
  day: string;
  /** 本人の選んだ種目 */
  events: JumpEvent[];
  units: Units;
  /** その日の記録（全種目）。古い順 */
  attempts: Attempt[];
}) {
  const t = useTranslations('today');
  const tEvents = useTranslations('events');
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
      <CardTitle
        action={
          <Link href={`/log/${day}/new`} className={buttonVariants({ size: 'sm' })}>
            <Plus aria-hidden className="size-4" />
            {t('add')}
          </Link>
        }
      >
        {t('attempts')}
      </CardTitle>
      {groups.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('noAttempts')}</p>
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
                        <span className="flex items-baseline gap-2">
                          <DisplayNumber size="md">
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
