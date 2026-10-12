'use client';

import { ExternalLink, MapPin, Pencil, Plus, Trash2 } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';
import { deleteCompetitionAction } from '@/app/actions/competitions';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { PrefectureLinks } from '@/components/prefecture-links';
import {
  Badge,
  Card,
  CardTitle,
  DisplayNumber,
  PageTitle,
  Stat,
  HALVES,
  LABEL,
  EmptyState,
} from '@/components/layout-ui';
import Link from 'next/link';
import { Button, buttonVariants } from '@/components/ui/button';
import type { Competition } from '@/lib/data';
import type { CompetitionResult } from '@/lib/competition-results';
import { daysBetween } from '@/lib/dates';
import { EVENT_TEXT } from '@/lib/events';
import { formatMarkParts, type Units } from '@/lib/units';

/**
 * 大会1件。日付・名前・会場・招集・開始・注意事項。これからの大会には残りの日数と申し込みのサイトを出す。
 * LP の見本の画面でも、見本のデータで使う
 */
export function CompetitionItem({
  competition,
  results,
  units,
  today,
  onDelete,
  sample = false,
}: {
  competition: Competition;
  /** その日に大会として入れた記録の、種目ごとの最高 */
  results: CompetitionResult[];
  units: Units;
  today: string;
  /** LP の見本では渡さない（押せない枠の中に置く） */
  onDelete?: () => void;
  /** LP の見本。リンクの先読みをしない（押せない枠の中でも、Next は画面に入ったリンクを先読みする） */
  sample?: boolean;
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
        {/* 名前と札（主目標・残りの日数）。札は名前のすぐ後ろに並べ、行の高さを右のアイコンボタンにそろえる */}
        <span className="flex min-h-9 flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-lg font-extrabold">{competition.name}</span>
          {competition.isTarget && <Badge tone="accent">{t('targetBadge')}</Badge>}
          {upcoming && (
            <Badge tone="accent">
              {tHome('daysLeft', { days: daysBetween(today, competition.day) })}
            </Badge>
          )}
        </span>
        {competition.venue && (
          <span className="flex items-start gap-1 text-sm break-keep wrap-anywhere text-muted-foreground">
            {/* 長い会場名が折り返しても、印は1行目の横に */}
            <MapPin aria-hidden className="mt-0.5 size-3.5 shrink-0" />
            {competition.venue}
          </span>
        )}
        {/* 招集と開始は1行ずつ（1行につなげると、スマホで場所の名前の途中で折り返した） */}
        {(competition.callRoomTime || competition.callRoomPlace) && (
          // 日本語の語の途中で折り返さない（「サブトラッ／ク」になった）。空白の位置で折り返し、
          // 空白の無い長い名前で収まらないときだけ、どこででも折り返す（はみ出さないように）
          <span className="text-sm break-keep wrap-anywhere text-muted-foreground tabular-nums">
            {t('callRoom', {
              time: [competition.callRoomTime, competition.callRoomPlace].filter(Boolean).join(' '),
            })}
          </span>
        )}
        {competition.startTime && (
          <span className="text-sm text-muted-foreground tabular-nums">
            {t('start', { time: competition.startTime })}
          </span>
        )}
        {competition.notes && <p className="text-sm whitespace-pre-wrap">{competition.notes}</p>}
        {/* 申し込みのサイト。申し込むのは大会の前なので、これからの大会にだけ出す。灰色の小さなボタン */}
        {upcoming && competition.entryUrl && (
          <a
            href={competition.entryUrl}
            target="_blank"
            rel="noreferrer"
            className={buttonVariants({
              variant: 'secondary',
              size: 'sm',
              className: 'mt-2 w-fit',
            })}
          >
            {tCompetitions('entry')}
            <ExternalLink aria-hidden />
          </a>
        )}
        {results.length > 0 && (
          <div className="mt-2 flex flex-col gap-1">
            <span className={LABEL}>{tCompetitions('result')}</span>
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
        prefetch={sample ? false : undefined}
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
  prefectureLinks,
}: {
  /** 画面の見出し。追加のボタンをその右端に置くので、見出しごとここで描く */
  title: string;
  upcoming: Competition[];
  past: Competition[];
  /** 日付ごとの大会の結果 */
  results: Record<string, CompetitionResult[]>;
  units: Units;
  today: string;
  /** 都道府県の陸協の大会日程を出すか（日本の人だけ） */
  prefectureLinks: boolean;
}) {
  const t = useTranslations('competitions');
  const tCalendar = useTranslations('calendar');
  const [removing, setRemoving] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const section = (
    title: string,
    items: Competition[],
    empty: string,
    action?: { href: string; label: string },
  ) => (
    <Card>
      <CardTitle>{title}</CardTitle>
      {items.length === 0 ? (
        <EmptyState message={empty} action={action} />
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
        <div className="flex flex-col gap-3">
          {section(t('upcoming'), upcoming, t('noUpcoming'), {
            href: '/competitions/new',
            label: tCalendar('addCompetition'),
          })}
          {prefectureLinks && <PrefectureLinks />}
        </div>
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
