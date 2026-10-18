'use client';

// 線（components/progress.tsx）を出すため、移るのは @bprogress の useRouter で
import { useRouter } from '@bprogress/next/app';
import { ChevronDown } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useActionState, useEffect, useMemo, useRef, useState } from 'react';
import { saveAttemptAction } from '@/app/actions/today';
import { safely } from '@/lib/safe-action';
import { ActionForm } from '@/components/action-form';
import {
  DisplayNumber,
  ErrorText,
  Field,
  FieldLabel,
  LABEL,
  segmentClass,
  TextArea,
} from '@/components/layout-ui';
import { CountInput, MarkInput, ShortLengthInput, WindInput } from '@/components/measure-inputs';
import { ConditionSection } from '@/components/day-log-form';
import { FormActions } from '@/components/form-actions';
import {
  completeSeries,
  HeightSeriesFields,
  isLiveError,
  toRows,
  useSeriesMessage,
  type HeightRowState,
} from '@/components/height-series-fields';
import { cn } from '@/lib/cn';
import {
  DETAIL_RANGES,
  detailFieldsFor,
  EMPTY_DETAILS,
  hasDetails,
  type AttemptDetails,
  type DetailKey,
} from '@/lib/attempt-details';
import type { Attempt } from '@/lib/data';
import { hasWind, type JumpEvent } from '@/lib/events';
import { checkSeries, hasHeightSeries, summarize, type SeriesError } from '@/lib/height-series';
import { NOTE_MAX_LENGTH } from '@/lib/limits';
import {
  feetInchesToMeters,
  formatMark,
  formatShortLength,
  metersToFeetInches,
  type Units,
} from '@/lib/units';

/** サーバーが範囲の外の欄を返すときの鍵の頭（src/lib/attempt-details.ts の detailsError） */
const DETAIL_RANGE_PREFIX = 'detailRange.';

/** サーバーが高さごとの結果を弾いたときの鍵の頭（src/app/actions/today.ts） */
const SERIES_PREFIX = 'series.';

/** 4分の1インチ（メートル） */
const QUARTER_INCH_M = 0.00635;

/**
 * 下限を本人の単位で。imperial の記録の書き方は4分の1インチの切り捨てなので、下限は1つ上の刻みにする
 * （切り捨てた値を入れると下限を割って弾かれる）
 */
function formatMin(meters: number, units: Units): string {
  if (units === 'metric') return formatMark(meters, units);
  const floored = feetInchesToMeters(metersToFeetInches(meters));
  return formatMark(floored < meters ? floored + QUARTER_INCH_M : meters, units);
}

/** 細かい記録の欄が範囲の外のときの文（どの欄か、範囲は本人の単位で）。ブラウザの検査とサーバーの答えの両方に使う */
function useDetailRangeMessage(units: Units) {
  const tErrors = useTranslations('errors');
  const tUnits = useTranslations('units');
  return (key: DetailKey): string => {
    const { min, max } = DETAIL_RANGES[key];
    switch (key) {
      case 'approachSteps':
        return tErrors(`detailRange.${key}`, { min: String(min), max: String(max) });
      case 'poleStiffnessLb':
        return tErrors(`detailRange.${key}`, {
          min: `${min} ${tUnits('lb')}`,
          max: `${max} ${tUnits('lb')}`,
        });
      case 'boardOffsetCm':
        return tErrors(`detailRange.${key}`, {
          over: formatShortLength(-min, units),
          behind: formatShortLength(max, units),
        });
      case 'standardsCm':
        return tErrors(`detailRange.${key}`, {
          min: formatShortLength(min, units),
          max: formatShortLength(max, units),
        });
      default:
        return tErrors(`detailRange.${key}`, {
          min: formatMin(min, units),
          max: formatMark(max, units),
        });
    }
  };
}

/** 2つ以上から1つを選ぶ、横並びの切り替え（練習・大会、種目） */
export function Segmented<T extends string>({
  options,
  value,
  label,
  onChange,
}: {
  options: readonly T[];
  value: T;
  label: (option: T) => string;
  onChange: (option: T) => void;
}) {
  return (
    <div
      className="grid gap-1 rounded-full bg-muted p-1"
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      {options.map((option) => (
        <button
          key={option}
          type="button"
          aria-pressed={value === option}
          onClick={() => onChange(option)}
          className={cn(segmentClass(value === option), 'truncate px-1')}
        >
          {label(option)}
        </button>
      ))}
    </div>
  );
}

/**
 * 試技を1本足す・直す入力（/log/[day]/new と /attempts/[id]/edit の画面）。種目はここで選ぶ。
 * 足すときのはじめの種目は、その日に最後に足した種目。保存したら、その日の画面へ戻る。入力は窓ではなく画面で行う（本人、2026-10-11「統一性がなくてわかりづらい」）
 */
export function AttemptForm({
  day,
  events,
  initialEvent,
  units,
  backHref,
  initial,
  askCondition = false,
}: {
  day: string;
  events: JumpEvent[];
  initialEvent: JumpEvent;
  units: Units;
  /** 戻る先（その日の画面） */
  backHref: string;
  /** 直すときの元の試技。無ければ足す */
  initial?: Attempt;
  /** その日のコンディションがまだ無い。閉じた「コンディションを入力」を出す（足すときだけ） */
  askCondition?: boolean;
}) {
  const t = useTranslations('today');
  const tEvents = useTranslations('events');
  const tErrors = useTranslations('errors');
  const tProfile = useTranslations('profile');
  const rangeMessage = useDetailRangeMessage(units);
  const seriesMessage = useSeriesMessage(units);
  const router = useRouter();
  const [event, setEvent] = useState<JumpEvent>(initialEvent);
  // 走高跳・棒高跳の高さごとの結果。種目を変えても残し（戻せば出る）、送るのは高さを持つ種目のときだけ
  const [rows, setRows] = useState<HeightRowState[]>(() => toRows(initial?.heightSeries ?? null));
  // 保存を押してから高さの行を触ったか。触ったら、サーバーが弾いた理由（送った行のもの）は出さない
  const [rowsEdited, setRowsEdited] = useState(false);
  const bySeries = hasHeightSeries(event) && rows.length > 0;
  // 高さがすべて入っている行の結果と、その確かめ・越えた高さ。ここで1度だけ求めて、高さの欄にも渡す
  const { complete, checked, best } = useMemo(() => {
    const series = completeSeries(rows, units);
    if (!series || series.length === 0) return { complete: series, checked: null, best: null };
    const result = checkSeries(series);
    return {
      complete: series,
      checked: result,
      best: result.ok ? result.summary.bestM : summarize(series).bestM,
    };
  }, [rows, units]);
  const [kind, setKind] = useState<'practice' | 'competition'>(initial?.kind ?? 'practice');
  // metric の記録の入れ方。走高跳・棒高跳は cm、走幅跳・三段跳は m と cm（中元さんの弟さんの要望、2026-10-18）
  const markStyle = hasHeightSeries(event) ? 'cm' : 'mcm';
  const [state, action, pending] = useActionState(async (previous: unknown, formData: FormData) => {
    setRowsEdited(false);
    const result = await safely(() => saveAttemptAction(null, formData));
    if (result?.ok) router.push(backHref);
    return result;
  }, null);
  const changeRows = (next: HeightRowState[]) => {
    setRows(next);
    setRowsEdited(true);
  };

  /** 高さの文（その位置の高さを本人の単位で） */
  const seriesText = (error: SeriesError, index: number | null) =>
    seriesMessage(error, index === null ? null : (complete?.[index]?.heightM ?? null));
  // サーバーが弾いた理由。どの高さかはサーバーが返した位置で言う（送った行のまま、触っていないあいだだけ）
  const serverSeries =
    state?.ok === false && state.error.startsWith(SERIES_PREFIX) && !rowsEdited
      ? seriesText(
          state.error.slice(SERIES_PREFIX.length) as SeriesError,
          'row' in state ? (state.row ?? null) : null,
        )
      : null;
  // その場で確かめた誤り。サーバーの理由を出しているあいだは、同じ文を2度出さない
  const live = checked && !checked.ok && isLiveError(checked.error) ? checked : null;
  const liveError = live && serverSeries === null ? seriesText(live.error, live.index) : null;

  return (
    <ActionForm action={action} className="flex flex-col gap-4">
      <input type="hidden" name="id" value={initial?.id ?? ''} />
      <input type="hidden" name="day" value={day} />
      <input type="hidden" name="event" value={event} />
      <input type="hidden" name="kind" value={kind} />
      {/* 切り替えにも、ほかの欄と同じく名前を付ける（名前の無い欄が混ざっていた。本人、2026-10-11） */}
      {events.length > 1 && (
        <div className="flex flex-col gap-1.5">
          <FieldLabel label={tProfile('events')} />
          <Segmented options={events} value={event} label={(e) => tEvents(e)} onChange={setEvent} />
        </div>
      )}
      <div className="flex flex-col gap-1.5">
        <FieldLabel label={t('kind')} />
        <Segmented
          options={['practice', 'competition'] as const}
          value={kind}
          label={(k) => t(k)}
          onChange={setKind}
        />
      </div>
      {/* 高さごとに入れているあいだは、記録はいちばん高く越えた高さ（サーバーも同じく決める）。
          記録の欄は消さずに隠して止める（止めた欄はブラウザの検査にも送る値にも入らない。隠した欄の検査で
          保存が黙って止まっていた）。高さをすべて消したら入れていた値に戻る */}
      <div hidden={bySeries}>
        <Field label={t('mark')} required={tProfile('required')}>
          <MarkInput
            // 入れ方が変わる種目の切り替えでは欄を作り直す（205 cm と 6 m 91 cm を取り違えない）
            key={markStyle}
            name="markM"
            units={units}
            metricStyle={markStyle}
            defaultMeters={initial?.markM ?? null}
            autoFocus
            disabled={bySeries}
          />
        </Field>
      </div>
      {bySeries && (
        <div className="flex flex-col gap-1.5" aria-live="polite">
          <FieldLabel label={t('markFromHeights')} />
          {best === null ? (
            <p className="text-sm text-muted-foreground">{t('noHeightCleared')}</p>
          ) : (
            <DisplayNumber size="md">{formatMark(best, units)}</DisplayNumber>
          )}
        </div>
      )}
      {hasHeightSeries(event) && (
        <HeightSeriesFields
          event={event}
          units={units}
          rows={rows}
          invalid={live !== null}
          error={liveError}
          onChange={changeRows}
        />
      )}
      {hasWind(event) && (
        <Field label={t('wind')}>
          <WindInput name="windMs" defaultValue={initial?.windMs ?? null} />
        </Field>
      )}
      <Field label={t('attemptNote')}>
        <TextArea name="note" maxLength={NOTE_MAX_LENGTH} defaultValue={initial?.note ?? ''} />
      </Field>
      <DetailsFields event={event} units={units} initial={initial?.details ?? EMPTY_DETAILS} />
      {askCondition && <ConditionSection />}
      <FormActions
        label={t('save')}
        pending={pending}
        message={
          <ErrorText>
            {state?.ok === false
              ? state.error.startsWith(SERIES_PREFIX)
                ? serverSeries
                : state.error.startsWith(DETAIL_RANGE_PREFIX)
                  ? rangeMessage(state.error.slice(DETAIL_RANGE_PREFIX.length) as DetailKey)
                  : tErrors(state.error as 'generic' | 'mark' | 'grip')
              : null}
          </ErrorText>
        }
      />
    </ActionForm>
  );
}

/**
 * 跳躍の細かい記録の欄（任意）。選んだ種目の欄だけ出す（src/lib/attempt-details.ts の detailFieldsFor）。
 * ふだんは閉じた「詳細」の中に置いて、記録だけ入れる人の画面を長くしない。直すときに1つでも入っていれば開いておく。
 * 閉じた details の中の欄も送られる。出していない種目の欄は送られず、サーバーでも種目に合わない欄は捨てる。
 * 中の欄をブラウザが止めたら開く（閉じたままだと止めた欄へ移れず、保存を押しても何も起きないように見える）
 */
function DetailsFields({
  event,
  units,
  initial,
}: {
  event: JumpEvent;
  units: Units;
  initial: AttemptDetails;
}) {
  const t = useTranslations('today');
  const tUnits = useTranslations('units');
  const rangeMessage = useDetailRangeMessage(units);
  const fields = detailFieldsFor(event);
  const shows = (key: keyof AttemptDetails) => fields.includes(key);
  const ref = useRef<HTMLDetailsElement>(null);
  const range = (key: DetailKey) => ({ ...DETAIL_RANGES[key], message: rangeMessage(key) });

  useEffect(() => {
    const details = ref.current;
    if (!details) return;
    // invalid は浮き上がらないので、捕まえる向きで聞く。ブラウザが欄へ移る前に開くよう、DOM へ直に書く
    const open = () => {
      details.open = true;
    };
    details.addEventListener('invalid', open, true);
    return () => details.removeEventListener('invalid', open, true);
  }, []);

  return (
    <details ref={ref} open={hasDetails(initial)} className="group">
      <summary className={cn('flex cursor-pointer list-none items-center gap-1', LABEL)}>
        {t('details')}
        <ChevronDown aria-hidden className="size-4 transition-transform group-open:rotate-180" />
      </summary>
      <div className="mt-3 grid gap-4 sm:grid-cols-2">
        <Field label={t('approachSteps')}>
          <CountInput
            name="approachSteps"
            unit={tUnits('steps')}
            min={DETAIL_RANGES.approachSteps.min}
            max={DETAIL_RANGES.approachSteps.max}
            defaultValue={initial.approachSteps}
          />
        </Field>
        <Field label={t('approachLength')}>
          <MarkInput
            name="approachLengthM"
            units={units}
            defaultMeters={initial.approachLengthM}
            range={range('approachLengthM')}
          />
        </Field>
        {shows('boardOffsetCm') && (
          <Field label={t('boardOffset')}>
            <ShortLengthInput
              name="boardOffsetCm"
              units={units}
              minCm={DETAIL_RANGES.boardOffsetCm.min}
              maxCm={DETAIL_RANGES.boardOffsetCm.max}
              defaultCm={initial.boardOffsetCm}
            />
          </Field>
        )}
        {shows('poleLengthM') && (
          <>
            <Field label={t('poleLength')}>
              <MarkInput
                name="poleLengthM"
                units={units}
                defaultMeters={initial.poleLengthM}
                range={range('poleLengthM')}
              />
            </Field>
            <Field label={t('poleStiffness')}>
              <CountInput
                name="poleStiffnessLb"
                unit={tUnits('lb')}
                min={DETAIL_RANGES.poleStiffnessLb.min}
                max={DETAIL_RANGES.poleStiffnessLb.max}
                defaultValue={initial.poleStiffnessLb}
              />
            </Field>
            <Field label={t('gripHeight')}>
              <MarkInput
                name="gripHeightM"
                units={units}
                defaultMeters={initial.gripHeightM}
                range={range('gripHeightM')}
              />
            </Field>
            <Field label={t('standards')}>
              <ShortLengthInput
                name="standardsCm"
                units={units}
                minCm={DETAIL_RANGES.standardsCm.min}
                maxCm={DETAIL_RANGES.standardsCm.max}
                defaultCm={initial.standardsCm}
              />
            </Field>
          </>
        )}
      </div>
    </details>
  );
}
