'use client';

import { Plus, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { ErrorText, FieldLabel, Input } from '@/components/layout-ui';
import { FeetInchesInput, Unit } from '@/components/measure-inputs';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';
import type { JumpEvent } from '@/lib/events';
import {
  checkSeries,
  nextHeight,
  TRIAL_SYMBOL,
  TRIALS_PER_HEIGHT,
  type HeightSeries,
  type SeriesError,
  type Trial,
} from '@/lib/height-series';
import { BAR_HEIGHT_MAX_M, BAR_HEIGHT_MIN_M } from '@/lib/limits';
import { feetInchesToMeters, formatMark, metersToFeetInches, type Units } from '@/lib/units';

/** 高さの欄の文字（両方の単位） */
type HeightText = { meters: string; feet: string; inches: string };

/**
 * 入力中の1つの高さ。stored は欄が触られるまで送る値（保存してある高さか、足したときに出した次の高さ）。
 * 欄の文字が initial と同じあいだは stored を送る（MarkInput と同じ。表示の丸めた値を送り返さない）
 */
export type HeightRowState = {
  key: number;
  stored: number | null;
  initial: HeightText;
  text: HeightText;
  trials: Trial[];
};

const SLOTS = Array.from({ length: TRIALS_PER_HEIGHT }, (_, i) => i);

function textOf(meters: number | null): HeightText {
  if (meters === null) return { meters: '', feet: '', inches: '' };
  const { feet, inches } = metersToFeetInches(meters);
  return { meters: meters.toFixed(2), feet: String(feet), inches: String(inches) };
}

function rowOf(key: number, meters: number | null, trials: Trial[] = []): HeightRowState {
  const text = textOf(meters);
  return { key, stored: meters, initial: text, text, trials };
}

/** 保存してある結果を、入力の行に */
export function toRows(series: HeightSeries | null): HeightRowState[] {
  return (series ?? []).map((row, i) => rowOf(i, row.heightM, row.trials));
}

/** 行の高さ（メートル）。空なら null */
function heightOf(row: HeightRowState, units: Units): number | null {
  const { text, initial } = row;
  if (units === 'metric') {
    if (text.meters === initial.meters && row.stored !== null) return row.stored;
    return text.meters.trim() === '' ? null : Number(text.meters);
  }
  if (text.feet === initial.feet && text.inches === initial.inches && row.stored !== null) {
    return row.stored;
  }
  if (text.feet === '' && text.inches === '') return null;
  return feetInchesToMeters({ feet: Number(text.feet || 0), inches: Number(text.inches || 0) });
}

/** 送る結果。高さの空の行は null のまま（ブラウザが required で止める） */
function seriesOf(rows: HeightRowState[], units: Units) {
  return rows.map((row) => ({ heightM: heightOf(row, units), trials: row.trials }));
}

/** 高さがすべて入っている行だけの結果（その場の検査と記録の表示に使う） */
export function completeSeries(rows: HeightRowState[], units: Units): HeightSeries | null {
  const series = seriesOf(rows, units);
  return series.every((r) => r.heightM !== null) ? (series as HeightSeries) : null;
}

/** 1回目の空の欄を押したときからの順。成功がいちばん多いので先 */
const CYCLE: (Trial | undefined)[] = [undefined, 'cleared', 'missed', 'passed'];

/**
 * i 回目の欄を押したあとの結果。失敗のあとだけ次の回へ進める。失敗から変えたら、その後ろは消す
 * （成功やパスのあとには跳べない）
 */
function cycleTrial(trials: Trial[], i: number): Trial[] {
  const next = CYCLE[(CYCLE.indexOf(trials[i]) + 1) % CYCLE.length];
  const before = trials.slice(0, i);
  if (next === undefined) return before;
  return next === 'missed' ? [...before, next, ...trials.slice(i + 1)] : [...before, next];
}

/** その場で出す誤り。結果の無い高さと、何も越えていないことは保存を押すまで言わない（入れている途中のため） */
export const LIVE_ERRORS: readonly SeriesError[] = [
  'heightOrder',
  'heightRange',
  'afterEnd',
  'unfinished',
  'afterElimination',
];

/** 誤りの文。高さはその行の高さを本人の単位で */
export function useSeriesMessage(units: Units) {
  const t = useTranslations('errors.series');
  return (error: SeriesError, height: number | null) => {
    const shown = height === null ? '' : formatMark(height, units);
    if (error === 'heightRange') {
      return t(error, {
        height: shown,
        min: formatMark(BAR_HEIGHT_MIN_M, units),
        max: formatMark(BAR_HEIGHT_MAX_M, units),
      });
    }
    return t(error, { height: shown });
  };
}

/**
 * 走高跳・棒高跳の「高さごと」の欄（/log/[day]/new と /attempts/[id]/edit）。1行が1つの高さで、
 * 高さの欄と、押すたびに 空 → O → X → – と変わる3つの欄、行を消すボタン。
 * 高さを足すと、前の高さに上げ幅を足した高さが入る（書き換えられる）。
 * 送るのは隠しの欄の JSON だけ。記録はサーバーがいちばん高く越えた高さにする
 */
export function HeightSeriesFields({
  event,
  units,
  rows,
  onChange,
}: {
  event: JumpEvent;
  units: Units;
  rows: HeightRowState[];
  onChange: (rows: HeightRowState[]) => void;
}) {
  const t = useTranslations('today');
  const tUnits = useTranslations('units');
  const message = useSeriesMessage(units);
  const metric = units === 'metric';

  const complete = completeSeries(rows, units);
  const checked = complete && complete.length > 0 ? checkSeries(complete) : null;
  const liveError =
    checked && !checked.ok && LIVE_ERRORS.includes(checked.error)
      ? message(checked.error, complete?.[checked.index]?.heightM ?? null)
      : null;
  // 続けて3回失敗したら、その先の高さは足せない
  const ended = checked?.ok === true && checked.summary.eliminated;

  const update = (key: number, change: Partial<HeightRowState>) =>
    onChange(rows.map((row) => (row.key === key ? { ...row, ...change } : row)));
  const add = () => {
    const last = rows.at(-1);
    const lastHeight = last ? heightOf(last, units) : null;
    const key = Math.max(-1, ...rows.map((row) => row.key)) + 1;
    onChange([
      ...rows,
      rowOf(key, lastHeight === null ? null : nextHeight(event, units, lastHeight)),
    ]);
  };

  return (
    <div className="flex flex-col gap-1.5">
      <FieldLabel label={t('heights')} />
      <input
        type="hidden"
        name="heightSeries"
        value={rows.length === 0 ? '' : JSON.stringify(seriesOf(rows, units))}
      />
      {rows.length > 0 && (
        <ol className="flex flex-col divide-y divide-border">
          {rows.map((row, index) => {
            const height = heightOf(row, units);
            const heightLabel = height === null ? t('barHeight') : formatMark(height, units);
            return (
              <li key={row.key} className="flex flex-wrap items-center gap-2 py-2">
                {/* メートルは高さと3つの欄が 375px でも1行に収まる。フィート・インチは欄が2つなので、
                    入りきらなければ3つの欄を次の行へ回す */}
                <div
                  className={cn(
                    'flex min-w-0 flex-1 items-center gap-2',
                    metric ? 'basis-28' : 'basis-56',
                  )}
                >
                  {metric ? (
                    <>
                      <Input
                        type="number"
                        inputMode="decimal"
                        step={0.01}
                        min={BAR_HEIGHT_MIN_M}
                        max={BAR_HEIGHT_MAX_M}
                        required
                        aria-label={t('barHeightN', { n: index + 1 })}
                        value={row.text.meters}
                        onChange={(e) =>
                          update(row.key, { text: { ...row.text, meters: e.target.value } })
                        }
                      />
                      <Unit>{tUnits('m')}</Unit>
                    </>
                  ) : (
                    <FeetInchesInput
                      feet={row.text.feet}
                      inches={row.text.inches}
                      inchStep={0.25}
                      required
                      labels={{
                        feet: t('barHeightFeet', { n: index + 1 }),
                        inches: t('barHeightInches', { n: index + 1 }),
                      }}
                      onChange={(feet, inches) =>
                        update(row.key, { text: { ...row.text, feet, inches } })
                      }
                    />
                  )}
                </div>
                <div className="flex items-center gap-1">
                  {SLOTS.map((i) => {
                    const trial = row.trials[i];
                    // 1回目と、前の回が失敗のときだけ押せる
                    const open = i === 0 || row.trials[i - 1] === 'missed';
                    return (
                      <button
                        key={i}
                        type="button"
                        disabled={!open}
                        aria-label={t('trialSlot', {
                          n: i + 1,
                          height: heightLabel,
                          result: trial ?? 'empty',
                        })}
                        onClick={() => update(row.key, { trials: cycleTrial(row.trials, i) })}
                        className={cn(
                          'flex size-9 items-center justify-center rounded-full text-sm font-extrabold transition-colors disabled:opacity-40',
                          trial === 'cleared' && 'bg-primary text-primary-foreground',
                          trial === 'missed' && 'bg-muted text-foreground',
                          trial === 'passed' && 'bg-muted text-muted-foreground',
                          trial === undefined &&
                            'border border-dashed border-border text-muted-foreground',
                        )}
                      >
                        {trial ? TRIAL_SYMBOL[trial] : ''}
                      </button>
                    );
                  })}
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={t('removeHeight', { height: heightLabel })}
                    onClick={() => onChange(rows.filter((r) => r.key !== row.key))}
                  >
                    <Trash2 aria-hidden />
                  </Button>
                </div>
              </li>
            );
          })}
        </ol>
      )}
      <ErrorText>{liveError}</ErrorText>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        className="w-fit"
        disabled={ended}
        onClick={add}
      >
        <Plus aria-hidden className="size-4" />
        {t('addHeight')}
      </Button>
    </div>
  );
}
