'use client';

import { MapPin, Pencil, Plus, Trash2 } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';
import { deleteCompetitionAction } from '@/app/actions/competitions';
import { CompetitionForm } from '@/components/competition-form';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { Card, CardTitle, PrimaryButton, Stat } from '@/components/layout-ui';
import type { Competition } from '@/lib/data';
import type { CompetitionResult } from '@/lib/competition-results';
import { daysBetween } from '@/lib/dates';
import { EVENT_TEXT } from '@/lib/events';
import { formatMarkParts, type Units } from '@/lib/units';

/** 大会1件。日付・名前・会場・招集・開始・注意事項。これからの大会には残りの日数を出す */
function CompetitionItem({
  competition,
  results,
  units,
  today,
  onEdit,
  onDelete,
}: {
  competition: Competition;
  /** その日に大会として入れた記録の、種目ごとの最高 */
  results: CompetitionResult[];
  units: Units;
  today: string;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const t = useTranslations('calendar');
  const tHome = useTranslations('home');
  const tEvents = useTranslations('events');
  const tCompetitions = useTranslations('competitions');
  const format = useFormatter();
  const upcoming = competition.day >= today;
  const date = new Date(`${competition.day}T00:00:00Z`);

  return (
    <div className="flex items-start gap-3 py-3">
      {/* 日付の札。これからの大会は黒、過去の大会は灰色 */}
      <div
        className={`flex w-14 shrink-0 flex-col items-center rounded-2xl py-2 ${
          upcoming ? 'bg-foreground text-background' : 'bg-muted text-muted-foreground'
        }`}
      >
        <span className="text-[11px] font-bold">
          {format.dateTime(date, { month: 'short', timeZone: 'UTC' })}
        </span>
        <span className="font-display text-[30px] leading-none font-extrabold italic tabular-nums">
          {date.getUTCDate()}
        </span>
        <span className="text-[11px] font-bold">
          {format.dateTime(date, { weekday: 'short', timeZone: 'UTC' })}
        </span>
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex items-start justify-between gap-2">
          <span className="text-base font-extrabold">{competition.name}</span>
          {upcoming && (
            <span className="shrink-0 rounded-full bg-secondary px-2.5 py-0.5 text-xs font-bold text-primary">
              {tHome('daysLeft', { days: daysBetween(today, competition.day) })}
            </span>
          )}
        </span>
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
        {results.length > 0 && (
          <div className="mt-2 flex flex-col gap-1">
            <span className="text-xs font-bold text-muted-foreground">
              {tCompetitions('result')}
            </span>
            <div className="flex flex-wrap gap-x-5 gap-y-2">
              {results.map((r) => (
                <Stat
                  key={r.event}
                  size="sm"
                  color={EVENT_TEXT[r.event]}
                  value={formatMarkParts(r.bestM, units)}
                  label={
                    r.windAided
                      ? tCompetitions('windAidedLabel', { event: tEvents(r.event) })
                      : tEvents(r.event)
                  }
                />
              ))}
            </div>
          </div>
        )}
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
  results,
  units,
  today,
}: {
  upcoming: Competition[];
  past: Competition[];
  /** 日付ごとの大会の結果 */
  results: Record<string, CompetitionResult[]>;
  units: Units;
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
                  results={results[competition.day] ?? []}
                  units={units}
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
          <PrimaryButton
            type="button"
            onClick={() => setEditing('new')}
            className="h-9 px-4 text-sm"
          >
            <Plus aria-hidden className="size-4" />
            {tCalendar('addCompetition')}
          </PrimaryButton>
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
