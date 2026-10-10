'use client';

import { MapPin, Pencil, Plus, Trash2 } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';
import { deleteCompetitionAction } from '@/app/actions/competitions';
import { CompetitionForm } from '@/components/competition-form';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { Card, CardTitle, SubtleButton } from '@/components/layout-ui';
import type { Competition } from '@/lib/data';
import { daysBetween } from '@/lib/dates';

/** 大会1件。日付・名前・会場・招集・開始・注意事項。これからの大会には残りの日数を出す */
function CompetitionItem({
  competition,
  today,
  onEdit,
  onDelete,
}: {
  competition: Competition;
  today: string;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const t = useTranslations('calendar');
  const tHome = useTranslations('home');
  const format = useFormatter();
  const upcoming = competition.day >= today;

  return (
    <div className="flex items-start gap-3 py-3">
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex items-baseline justify-between gap-3 text-sm text-muted-foreground tabular-nums">
          {format.dateTime(new Date(`${competition.day}T00:00:00Z`), {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            weekday: 'short',
            timeZone: 'UTC',
          })}
          {upcoming && (
            <span className="font-semibold text-primary">
              {tHome('daysLeft', { days: daysBetween(today, competition.day) })}
            </span>
          )}
        </span>
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
        {competition.notes && <p className="text-sm whitespace-pre-wrap">{competition.notes}</p>}
      </div>
      <button
        type="button"
        aria-label={t('editCompetition')}
        onClick={onEdit}
        className="flex size-9 items-center justify-center rounded-full text-muted-foreground hover:bg-accent"
      >
        <Pencil aria-hidden className="size-4" />
      </button>
      <button
        type="button"
        aria-label={t('delete')}
        onClick={onDelete}
        className="flex size-9 items-center justify-center rounded-full text-muted-foreground hover:bg-accent"
      >
        <Trash2 aria-hidden className="size-4" />
      </button>
    </div>
  );
}

/**
 * 大会の画面の中身。これからの大会（近い順）と過去の大会（新しい順）を分けて並べ、
 * 足す・直す・消すをここで行う
 */
export function CompetitionsBoard({
  upcoming,
  past,
  today,
}: {
  upcoming: Competition[];
  past: Competition[];
  today: string;
}) {
  const t = useTranslations('competitions');
  const tCalendar = useTranslations('calendar');
  // 'new' は追加、id は編集中の大会
  const [editing, setEditing] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const section = (title: string, items: Competition[], empty: string) => (
    <Card>
      <CardTitle>{title}</CardTitle>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul className="flex flex-col divide-y divide-border">
          {items.map((competition) => (
            <li key={competition.id}>
              {editing === competition.id ? (
                <div className="py-3">
                  <CompetitionForm
                    initial={competition}
                    defaultDay={competition.day}
                    onDone={() => setEditing(null)}
                  />
                </div>
              ) : (
                <CompetitionItem
                  competition={competition}
                  today={today}
                  onEdit={() => setEditing(competition.id)}
                  onDelete={() => setRemoving(competition.id)}
                />
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );

  return (
    <>
      {editing === 'new' && (
        <Card>
          <CardTitle>{tCalendar('addCompetition')}</CardTitle>
          <CompetitionForm initial={null} defaultDay={today} onDone={() => setEditing(null)} />
        </Card>
      )}
      {editing !== 'new' && (
        <div className="px-4">
          <SubtleButton type="button" onClick={() => setEditing('new')}>
            <Plus aria-hidden className="size-4" />
            {tCalendar('addCompetition')}
          </SubtleButton>
        </div>
      )}
      <div className="flex flex-col gap-3 lg:grid lg:grid-cols-2 lg:items-start">
        {section(t('upcoming'), upcoming, t('noUpcoming'))}
        {section(t('past'), past, t('noPast'))}
      </div>
      <ConfirmDialog
        open={removing !== null}
        title={tCalendar('deleteConfirm')}
        onOpenChange={(open) => {
          if (!open) setRemoving(null);
        }}
        onConfirm={() => {
          const id = removing;
          if (id) startTransition(() => deleteCompetitionAction(id));
        }}
      />
    </>
  );
}
