'use client';

import { MapPin, Pencil, Plus, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';
import { deleteCompetitionAction } from '@/app/actions/competitions';
import { CompetitionForm } from '@/components/competition-form';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { Card, CardTitle, SubtleButton } from '@/components/layout-ui';
import type { Attempt, Competition } from '@/lib/data';
import { formatMark, type Units } from '@/lib/units';

/**
 * 選んだ日の中身。その日の大会と記録を並べ、大会はここで足す・直す・消す。
 * 記録は「今日」の画面で入れるので、その日を開くリンクを置く（先の日は開かない）
 */
export function DayPanel({
  day,
  title,
  canOpenDay,
  attempts,
  competitions,
  units,
}: {
  day: string;
  title: string;
  canOpenDay: boolean;
  attempts: Attempt[];
  competitions: Competition[];
  units: Units;
}) {
  const t = useTranslations('calendar');
  const tToday = useTranslations('today');
  const tEvents = useTranslations('events');
  const tNav = useTranslations('nav');
  // 'new' は追加、id は編集中の大会
  const [editing, setEditing] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  // 消す前に確かめている大会
  const [removing, setRemoving] = useState<string | null>(null);

  return (
    <>
      <ConfirmDialog
        open={removing !== null}
        title={t('deleteConfirm')}
        onOpenChange={(open) => {
          if (!open) setRemoving(null);
        }}
        onConfirm={() => {
          const id = removing;
          if (id) startTransition(() => deleteCompetitionAction(id));
        }}
      />
      <Card>
        <CardTitle
          action={
            canOpenDay && (
              <Link
                href={`/today?day=${day}`}
                className="inline-flex h-9 items-center rounded-full bg-secondary px-3.5 text-sm font-semibold text-primary"
              >
                {tNav('today')}
              </Link>
            )
          }
        >
          {title}
        </CardTitle>
        {competitions.length === 0 && attempts.length === 0 && (
          <p className="text-sm text-muted-foreground">{t('noRecords')}</p>
        )}
        <ul className="flex flex-col divide-y divide-border">
          {competitions.map((competition) =>
            editing === competition.id ? (
              <li key={competition.id} className="py-3">
                <CompetitionForm
                  initial={competition}
                  defaultDay={day}
                  onDone={() => setEditing(null)}
                />
              </li>
            ) : (
              <li key={competition.id} className="flex items-start gap-3 py-3">
                <span className="mt-1.5 size-2 shrink-0 rounded-full bg-destructive" />
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="font-bold">{competition.name}</span>
                  {competition.venue && (
                    <span className="flex items-center gap-1 text-sm text-muted-foreground">
                      <MapPin aria-hidden className="size-3.5" />
                      {competition.venue}
                    </span>
                  )}
                  <span className="text-sm text-muted-foreground tabular-nums">
                    {[
                      (competition.callRoomTime || competition.callRoomPlace) &&
                        t('callRoom', {
                          time: [competition.callRoomTime, competition.callRoomPlace]
                            .filter(Boolean)
                            .join(' '),
                        }),
                      competition.startTime && t('start', { time: competition.startTime }),
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                  {competition.notes && (
                    <p className="text-sm whitespace-pre-wrap">{competition.notes}</p>
                  )}
                </div>
                <button
                  type="button"
                  aria-label={t('editCompetition')}
                  onClick={() => setEditing(competition.id)}
                  className="flex size-9 items-center justify-center rounded-full text-muted-foreground active:bg-accent"
                >
                  <Pencil aria-hidden className="size-4" />
                </button>
                <button
                  type="button"
                  aria-label={t('delete')}
                  onClick={() => setRemoving(competition.id)}
                  className="flex size-9 items-center justify-center rounded-full text-muted-foreground active:bg-accent"
                >
                  <Trash2 aria-hidden className="size-4" />
                </button>
              </li>
            ),
          )}
          {attempts.map((attempt) => (
            <li key={attempt.id} className="flex items-center gap-3 py-2.5">
              <span className="size-2 shrink-0 rounded-full bg-primary" />
              <span className="flex-1 text-sm">
                {tEvents(attempt.event)} · {tToday(attempt.kind)}
              </span>
              <span className="font-bold tabular-nums">{formatMark(attempt.markM, units)}</span>
            </li>
          ))}
        </ul>
      </Card>

      <Card>
        {editing === 'new' ? (
          <>
            <CardTitle>{t('addCompetition')}</CardTitle>
            <CompetitionForm initial={null} defaultDay={day} onDone={() => setEditing(null)} />
          </>
        ) : (
          <SubtleButton type="button" onClick={() => setEditing('new')} className="w-full">
            <Plus aria-hidden className="size-4" />
            {t('addCompetition')}
          </SubtleButton>
        )}
      </Card>
    </>
  );
}
