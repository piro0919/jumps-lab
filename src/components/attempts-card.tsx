'use client';

import { Pencil, Plus, Trash2, Video } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import Link from 'next/link';
import { useState, useTransition } from 'react';
import { deleteAttemptAction } from '@/app/actions/today';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { Badge, Card, CardTitle, DisplayNumber, EmptyState } from '@/components/layout-ui';
import { Button, buttonVariants } from '@/components/ui/button';
import type { AttemptDetails, DetailKey } from '@/lib/attempt-details';
import type { Attempt } from '@/lib/data';
import { EVENT_BG, isWindAided, type JumpEvent } from '@/lib/events';
import { summarize, trialSymbols, type HeightSeries } from '@/lib/height-series';
import { formatMark, formatShortLength, type Units } from '@/lib/units';

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
  readOnly = false,
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
  /** 見るだけ（コーチが選手の記録を見る画面）。足す・直す・消すを出さない */
  readOnly?: boolean;
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
          groups.length === 0 || readOnly ? undefined : (
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
          action={readOnly ? undefined : { href: `/log/${day}/new`, label: t('addAttempt') }}
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
                      {/* 高さごとの結果は一覧（ol）なので、入れ物は span ではなく div */}
                      <div className="flex min-w-0 flex-1 flex-col">
                        {/* 数字は折らず、入りきらない札を次の行へ回す（「ベスト」と「追い風参考」が並ぶと、
                            幅 375px で m が次の行に落ち、札が鉛筆に重なった。2026-10-11） */}
                        <span className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                          <DisplayNumber size="md" className="whitespace-nowrap">
                            {formatMark(attempt.markM, units)}
                          </DisplayNumber>
                          {/* 結び付けた動画へ。同じ画面の動画の欄まで飛ぶ。押せる所は 24px 四方（アイコンだけだと 16px だった）。
                              札より前に置く（札の後ろだと、幅 375px で動画の印だけが次の行に落ちて浮いた。2026-10-15） */}
                          {videos[attempt.id] && (
                            <a
                              href={`#video-${videos[attempt.id]}`}
                              aria-label={tVideos('play')}
                              className="inline-flex size-6 items-center justify-center self-center text-muted-foreground hover:text-foreground"
                            >
                              <Video aria-hidden className="size-4" />
                            </a>
                          )}
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
                        <span className="text-xs break-words text-muted-foreground">
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
                        {attempt.heightSeries && (
                          <SeriesLine series={attempt.heightSeries} units={units} />
                        )}
                        <DetailsLine details={attempt.details} units={units} />
                      </div>
                      {/* 行の操作はアイコンだけのボタン（大会の一覧と同じ）。直すのは別の画面 */}
                      {!readOnly && (
                        <>
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
                        </>
                      )}
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

/**
 * 試技の細かい記録を1行で（入っている欄だけ）。欄ごとに文の形の訳を作り、並べるのは言語の書き方の並べ方
 * （Intl.ListFormat）に任せる。コードで語をつながない。長さは本人の単位、ポールの硬さはどちらでもポンド
 */
function DetailsLine({ details, units }: { details: AttemptDetails; units: Units }) {
  const t = useTranslations('today');
  const format = useFormatter();
  const d = details;
  const board = d.boardOffsetCm;
  // 欄の名前と文の組。key は欄の名前（文は同じになりうるので key にしない）
  const phrases: [DetailKey, string | null][] = [
    ['approachSteps', d.approachSteps === null ? null : t('lineSteps', { count: d.approachSteps })],
    [
      'approachLengthM',
      d.approachLengthM === null
        ? null
        : t('lineApproach', { length: formatMark(d.approachLengthM, units) }),
    ],
    [
      'boardOffsetCm',
      board === null
        ? null
        : t('lineBoard', {
            side: board > 0 ? 'behind' : board < 0 ? 'over' : 'on',
            length: formatShortLength(Math.abs(board), units),
          }),
    ],
    [
      'poleLengthM',
      d.poleLengthM === null ? null : t('linePole', { length: formatMark(d.poleLengthM, units) }),
    ],
    [
      'poleStiffnessLb',
      d.poleStiffnessLb === null ? null : t('lineStiffness', { lb: d.poleStiffnessLb }),
    ],
    [
      'gripHeightM',
      d.gripHeightM === null ? null : t('lineGrip', { length: formatMark(d.gripHeightM, units) }),
    ],
    [
      'standardsCm',
      d.standardsCm === null
        ? null
        : t('lineStandards', { length: formatShortLength(d.standardsCm, units) }),
    ],
  ];
  const shown = phrases.filter((entry): entry is [DetailKey, string] => entry[1] !== null);
  if (shown.length === 0) return null;
  // 欄ごとの文は途中で折らない（日本語は語の途中でも折れ、「支柱」が2行に割れた）
  const items = shown.map(([key, phrase]) => (
    <span key={key} className="whitespace-nowrap">
      {phrase}
    </span>
  ));
  return (
    <span className="text-xs text-muted-foreground">
      {format.list(items, { type: 'unit', style: 'short' })}
    </span>
  );
}

/**
 * 走高跳・棒高跳の高さごとの結果を「1.80 m O  1.85 m XO  1.90 m XXX」の形で（記録用紙と同じ O・X・–）。
 * 高さは本人の単位。読み上げには記号ではなく「成功・失敗・パス」の語を渡す。
 * その下に、同じ高さで並んだときに順位を分ける2つの失敗の数（TR26.8）
 */
function SeriesLine({ series, units }: { series: HeightSeries; units: Units }) {
  const t = useTranslations('today');
  const format = useFormatter();
  const { missesAtBest, missesTotal } = summarize(series);
  return (
    <>
      <ol className="flex flex-wrap gap-x-3 text-xs text-muted-foreground">
        {series.map((row) => {
          const height = formatMark(row.heightM, units);
          const words = row.trials.map((result) => t('trialWord', { result }));
          return (
            <li
              key={row.heightM}
              aria-label={t('seriesItem', {
                height,
                results: format.list(words, { type: 'unit', style: 'short' }),
              })}
              className="whitespace-nowrap"
            >
              <span aria-hidden>
                {height}{' '}
                <span className="font-bold text-foreground">{trialSymbols(row.trials)}</span>
              </span>
            </li>
          );
        })}
      </ol>
      <span className="text-xs text-muted-foreground">
        {t('lineMisses', { total: missesTotal, atBest: missesAtBest })}
      </span>
    </>
  );
}
