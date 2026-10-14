'use client';

import { useTranslations } from 'next-intl';
import { type Ref, useEffect, useRef, useState } from 'react';
import { Input } from '@/components/layout-ui';
import {
  cmToFeetInches,
  cmToQuarterInches,
  feetInchesToCm,
  inchesToCm,
  feetInchesToMeters,
  kgToLb,
  lbToKg,
  metersToFeetInches,
  type Units,
} from '@/lib/units';
import { WIND_LIMIT_MS } from '@/lib/limits';

/** 体重の欄の刻み（kg のとき。lb は 1） */
const WEIGHT_STEP_KG = 0.1;

/**
 * 長さと重さの入力。表示の単位で受け、送るのは隠しの欄に入れたメートル・cm・kg だけ。
 * サーバーは単位を知らなくて済む
 */

export function Unit({ children }: { children: string }) {
  return <span className="shrink-0 text-sm text-muted-foreground">{children}</span>;
}

const parse = (value: string) => (value.trim() === '' ? null : Number(value));

export function FeetInchesInput({
  feet,
  inches,
  inchStep,
  onChange,
  autoFocus,
  feetRef,
  required,
  disabled,
  labels,
}: {
  feet: string;
  inches: string;
  inchStep: number;
  onChange: (feet: string, inches: string) => void;
  /** フィートの欄に、はじめから入る */
  autoFocus?: boolean;
  /** フィートの欄（合わせた長さの範囲を、この欄で止めるため） */
  feetRef?: Ref<HTMLInputElement>;
  /** フィートの欄を空で送らせない */
  required?: boolean;
  /** 止める（ブラウザの検査にも入らない） */
  disabled?: boolean;
  /** 見出しの無い所に置くときの、2つの欄の読み上げの名前 */
  labels?: { feet: string; inches: string };
}) {
  const t = useTranslations('units');
  return (
    <div className="flex items-center gap-2">
      <Input
        ref={feetRef}
        inputMode="numeric"
        type="number"
        min={0}
        step={1}
        value={feet}
        autoFocus={autoFocus}
        required={required}
        disabled={disabled}
        aria-label={labels?.feet}
        onChange={(e) => onChange(e.target.value, inches)}
      />
      <Unit>{t('ft')}</Unit>
      <Input
        inputMode="decimal"
        type="number"
        min={0}
        max={11.75}
        step={inchStep}
        value={inches}
        disabled={disabled}
        aria-label={labels?.inches}
        onChange={(e) => onChange(feet, e.target.value)}
      />
      <Unit>{t('in')}</Unit>
    </div>
  );
}

function toFeetInches(
  value: number | null,
  convert: (v: number) => { feet: number; inches: number },
) {
  if (value === null) return { feet: '', inches: '' };
  const { feet, inches } = convert(value);
  return { feet: String(feet), inches: String(inches) };
}

/**
 * 風速（m/s）。単位は国によらず m/s のまま。単位はほかの欄と同じく欄の右に出す
 * （名前に「（m/s）」と括弧で入れていて、記録の欄と書き方が違っていた。本人、2026-10-11）
 */
export function WindInput({
  name,
  defaultValue = null,
}: {
  name: string;
  defaultValue?: number | null;
}) {
  const t = useTranslations('units');
  return (
    <div className="flex items-center gap-2">
      <Input
        name={name}
        type="number"
        inputMode="decimal"
        step={0.1}
        min={-WIND_LIMIT_MS}
        max={WIND_LIMIT_MS}
        defaultValue={defaultValue ?? ''}
      />
      <Unit>{t('ms')}</Unit>
    </div>
  );
}

/**
 * 保存してある値を、欄が触られるまでそのまま送る。表示の単位に直した文字は丸めてあるので、
 * それを送り返すと、何も直さずに保存しただけで値が変わる（metric で 4.572 m が 4.57 m に、
 * imperial で cm で入れた 12 cm が 12.1 cm に、メートルで入れた記録が4分の1インチに切り捨てられていた）。
 * 欄の文字がはじめと同じなら、書き換えて戻した場合も含めて、持っている値を送る
 */
function sentValue(stored: number | null, untouched: boolean, typed: string): string {
  return stored !== null && untouched ? String(stored) : typed;
}

/** 範囲（メートル）と、外れたときにブラウザが出す文言（どの欄かを言う、訳した文） */
export type MeterRange = { min: number; max: number; message: string };

/**
 * 記録（メートル）。imperial は 4分の1インチ刻み。ポールの長さ・グリップ・助走の距離にも使う（range で範囲を付ける）。
 * imperial はフィートとインチの2つの欄に分かれていて、ブラウザの min・max では範囲を言えないので、
 * 合わせた長さが外れたらフィートの欄に自前の検査を付けて止める
 */
export function MarkInput({
  name,
  units,
  defaultMeters = null,
  autoFocus,
  range,
  disabled,
}: {
  name: string;
  units: Units;
  defaultMeters?: number | null;
  autoFocus?: boolean;
  range?: MeterRange;
  /** 止める。送る値にもブラウザの検査にも入らず、入れた文字は残る（高さごとに入れている記録の欄） */
  disabled?: boolean;
}) {
  const t = useTranslations('units');
  // はじめに出した文字（両方の単位）。いまの文字と比べて、触られたかを見る
  const [initial] = useState(() => ({
    meters: defaultMeters === null ? '' : defaultMeters.toFixed(2),
    fi: toFeetInches(defaultMeters, metersToFeetInches),
  }));
  const [meters, setMeters] = useState(initial.meters);
  const [fi, setFi] = useState(initial.fi);
  const feetRef = useRef<HTMLInputElement>(null);
  const metric = units === 'metric';

  const untouched = metric
    ? meters === initial.meters
    : fi.feet === initial.fi.feet && fi.inches === initial.fi.inches;
  const typedFeetInches =
    fi.feet === '' && fi.inches === ''
      ? null
      : feetInchesToMeters({ feet: Number(fi.feet || 0), inches: Number(fi.inches || 0) });
  const typed = metric ? meters : typedFeetInches === null ? '' : String(typedFeetInches);
  const value = sentValue(defaultMeters, untouched, typed);

  const outside =
    !metric &&
    range !== undefined &&
    !untouched &&
    typedFeetInches !== null &&
    (typedFeetInches < range.min || typedFeetInches > range.max);
  const message = outside ? range.message : '';
  useEffect(() => {
    feetRef.current?.setCustomValidity(message);
  }, [message, metric]);

  return (
    <>
      <input type="hidden" name={name} value={value} disabled={disabled} />
      {metric ? (
        <div className="flex items-center gap-2">
          <Input
            inputMode="decimal"
            type="number"
            min={range?.min ?? 0}
            max={range?.max}
            step={0.01}
            value={meters}
            disabled={disabled}
            autoFocus={autoFocus}
            onChange={(e) => setMeters(e.target.value)}
          />
          <Unit>{t('m')}</Unit>
        </div>
      ) : (
        <FeetInchesInput
          feet={fi.feet}
          inches={fi.inches}
          inchStep={0.25}
          autoFocus={autoFocus}
          disabled={disabled}
          feetRef={feetRef}
          onChange={(feet, inches) => setFi({ feet, inches })}
        />
      )}
    </>
  );
}

/**
 * 短い長さの欄の刻み。cm のときは DB と同じ 0.1cm（インチで入れた 45.7 cm を、1cm 刻みの欄に出すと
 * ブラウザが送るのを止めていた）。インチのときは4分の1インチ
 */
const SHORT_STEP_CM = 0.1;
const SHORT_STEP_IN = 0.25;

/**
 * 短い長さ（cm）。踏切板からの距離や支柱の位置。imperial はインチで受け、4分の1インチ刻み。
 * 範囲は cm で受けて、インチの欄にはその換算を出す（換算はいちばん近い4分の1インチ。持っている値も同じ丸めで
 * 出すので、範囲の中の値が欄の範囲から外れることはない）
 */
export function ShortLengthInput({
  name,
  units,
  defaultCm = null,
  minCm,
  maxCm,
}: {
  name: string;
  units: Units;
  defaultCm?: number | null;
  minCm: number;
  maxCm: number;
}) {
  const t = useTranslations('units');
  const metric = units === 'metric';
  const [initial] = useState(() =>
    defaultCm === null ? '' : String(metric ? defaultCm : cmToQuarterInches(defaultCm)),
  );
  const [shown, setShown] = useState(initial);
  const parsed = parse(shown);
  const typed = parsed === null ? '' : String(metric ? parsed : inchesToCm(parsed));
  const value = sentValue(defaultCm, shown === initial, typed);

  return (
    <>
      <input type="hidden" name={name} value={value} />
      <div className="flex items-center gap-2">
        <Input
          inputMode="decimal"
          type="number"
          step={metric ? SHORT_STEP_CM : SHORT_STEP_IN}
          min={metric ? minCm : cmToQuarterInches(minCm)}
          max={metric ? maxCm : cmToQuarterInches(maxCm)}
          value={shown}
          onChange={(e) => setShown(e.target.value)}
        />
        <Unit>{metric ? t('cm') : t('in')}</Unit>
      </div>
    </>
  );
}

/** 整数の欄（助走の歩数、ポールの硬さのポンド）。単位は国によらない */
export function CountInput({
  name,
  unit,
  defaultValue = null,
  min,
  max,
}: {
  name: string;
  /** 欄の右に出す単位（訳した文字） */
  unit: string;
  defaultValue?: number | null;
  min: number;
  max: number;
}) {
  return (
    <div className="flex items-center gap-2">
      <Input
        name={name}
        type="number"
        inputMode="numeric"
        step={1}
        min={min}
        max={max}
        defaultValue={defaultValue ?? ''}
      />
      <Unit>{unit}</Unit>
    </div>
  );
}

/** 身長（cm） */
export function HeightInput({
  name,
  units,
  defaultCm = null,
}: {
  name: string;
  units: Units;
  defaultCm?: number | null;
}) {
  const t = useTranslations('units');
  const [cm, setCm] = useState(defaultCm === null ? '' : String(defaultCm));
  const [fi, setFi] = useState(() => toFeetInches(defaultCm, cmToFeetInches));

  const value =
    units === 'metric'
      ? cm
      : fi.feet === '' && fi.inches === ''
        ? ''
        : String(feetInchesToCm({ feet: Number(fi.feet || 0), inches: Number(fi.inches || 0) }));

  return (
    <>
      <input type="hidden" name={name} value={value} />
      {units === 'metric' ? (
        <div className="flex items-center gap-2">
          <Input
            inputMode="decimal"
            type="number"
            min={0}
            step={0.1}
            value={cm}
            onChange={(e) => setCm(e.target.value)}
          />
          <Unit>{t('cm')}</Unit>
        </div>
      ) : (
        <FeetInchesInput
          feet={fi.feet}
          inches={fi.inches}
          inchStep={1}
          onChange={(feet, inches) => setFi({ feet, inches })}
        />
      )}
    </>
  );
}

/** 体重（kg） */
export function WeightInput({
  name,
  units,
  defaultKg = null,
}: {
  name: string;
  units: Units;
  defaultKg?: number | null;
}) {
  const t = useTranslations('units');
  const [shown, setShown] = useState(() =>
    defaultKg === null ? '' : String(units === 'metric' ? defaultKg : kgToLb(defaultKg)),
  );
  const parsed = parse(shown);
  const value = parsed === null ? '' : String(units === 'metric' ? parsed : lbToKg(parsed));

  return (
    <>
      <input type="hidden" name={name} value={value} />
      <div className="flex items-center gap-2">
        <Input
          inputMode="decimal"
          type="number"
          min={0}
          step={units === 'metric' ? WEIGHT_STEP_KG : 1}
          value={shown}
          onChange={(e) => setShown(e.target.value)}
        />
        <Unit>{units === 'metric' ? t('kg') : t('lb')}</Unit>
      </div>
    </>
  );
}
