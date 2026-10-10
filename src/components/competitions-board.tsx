'use client';

import { MapPin, Pencil, Plus, Trash2 } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';
import { deleteCompetitionAction } from '@/app/actions/competitions';
import { ConfirmDialog } from '@/components/confirm-dialog';
import {
  Badge,
  Card,
  CardTitle,
  DisplayNumber,
  PageTitle,
  Stat,
  HALVES,
} from '@/components/layout-ui';
import Link from 'next/link';
import { Button, buttonVariants } from '@/components/ui/button';
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
  onDelete,
}: {
  competition: Competition;
  /** その日に大会として入れた記録の、種目ごとの最高 */
  results: CompetitionResult[];
  units: Units;
  today: string;
  onDelete: () => void;
}) {
  const t = useTranslations('calendar');
  const tHome = useTranslations('home');
  const tEvents = useTranslations('events');
  const tCompetitions = useTranslations('competitions');
  const tToday = useTranslations('today');
  const format = useFormatter();
  const upcoming = competition.day >= today;
  const date = new Date(`${competition.day}T00:00:00Z`);

  return (
    <div className="flex items-start gap-3 py-3">
      {/* 日付の札。これからの大会は黒、過去の大会は灰色 */}
      <div
        className={`flex w-14 shrink-0 flex-col items-center rounded-2xl py-2 ${
          upcoming ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
        }`}
      >
        <span className="text-xs font-bold">
          {format.dateTime(date, { month: 'short', timeZone: 'UTC' })}
        </span>
        <DisplayNumber size="md">{date.getUTCDate()}</DisplayNumber>
        <span className="text-xs font-bold">
          {format.dateTime(date, { weekday: 'short', timeZone: 'UTC' })}
        </span>
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex items-start justify-between gap-2">
          <span className="text-base font-extrabold">{competition.name}</span>
          {upcoming && (
            <Badge tone="accent">
              {tHome('daysLeft', { days: daysBetween(today, competition.day) })}
            </Badge>
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
                <div key={r.event} className="flex flex-col gap-1">
                  <Stat
                    size="sm"
                    color={EVENT_TEXT[r.event]}
                    value={formatMarkParts(r.bestM, units)}
                    label={tEvents(r.event)}
                  />
                  {/* 追い風参考は記録の日の画面と同じ札で（括弧書きと札の2通りになっていた） */}
                  {r.windAided && <Badge tone="neutral">{tToday('windAided')}</Badge>}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      <Link
        href={`/competitions/${competition.id}/edit`}
        aria-label={t('editCompetition')}
        className={buttonVariants({ variant: 'ghost', size: 'icon' })}
      >
        <Pencil aria-hidden />
      </Link>
      <Button variant="ghost" size="icon" type="button" aria-label={t('delete')} onClick={onDelete}>
        <Trash2 aria-hidden />
      </Button>
    </div>
  );
}

/**
 * 大会の画面の中身。これからの大会（近い順）と過去の大会（新しい順）を分けて並べ、
 * 足す・直す・消すをここで行う
 */
export function CompetitionsBoard({
  title,
  upcoming,
  past,
  results,
  units,
  today,
}: {
  /** 画面の見出し。追加のボタンをその右端に置くので、見出しごとここで描く */
  title: string;
  upcoming: Competition[];
  past: Competition[];
  /** 日付ごとの大会の結果 */
  results: Record<string, CompetitionResult[]>;
  units: Units;
  today: string;
}) {
  const t = useTranslations('competitions');
  const tCalendar = useTranslations('calendar');
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
              <CompetitionItem
                competition={competition}
                results={results[competition.day] ?? []}
                units={units}
                today={today}
                onDelete={() => setRemoving(competition.id)}
              />
            </li>
          ))}
        </ul>
      )}
    </Card>
  );

  return (
    <>
      <PageTitle
        action={
          <Link href="/competitions/new" className={buttonVariants({ size: 'sm' })}>
            <Plus aria-hidden className="size-4" />
            {tCalendar('add')}
          </Link>
        }
      >
        {title}
      </PageTitle>
      <div className={HALVES}>
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
