'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
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

function Unit({ children }: { children: string }) {
  return <span className="shrink-0 text-sm text-muted-foreground">{children}</span>;
}

const parse = (value: string) => (value.trim() === '' ? null : Number(value));

function FeetInchesInput({
  feet,
  inches,
  inchStep,
  onChange,
  autoFocus,
}: {
  feet: string;
  inches: string;
  inchStep: number;
  onChange: (feet: string, inches: string) => void;
  /** フィートの欄に、はじめから入る */
  autoFocus?: boolean;
}) {
  const t = useTranslations('units');
  return (
    <div className="flex items-center gap-2">
      <Input
        inputMode="numeric"
        type="number"
        min={0}
        step={1}
        value={feet}
        autoFocus={autoFocus}
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

/** 記録（メートル）。imperial は 4分の1インチ刻み */
export function MarkInput({
  name,
  units,
  defaultMeters = null,
  autoFocus,
}: {
  name: string;
  units: Units;
  defaultMeters?: number | null;
  autoFocus?: boolean;
}) {
  const t = useTranslations('units');
  const [meters, setMeters] = useState(defaultMeters === null ? '' : defaultMeters.toFixed(2));
  const [fi, setFi] = useState(() => toFeetInches(defaultMeters, metersToFeetInches));

  const value =
    units === 'metric'
      ? meters
      : fi.feet === '' && fi.inches === ''
        ? ''
        : String(
            feetInchesToMeters({ feet: Number(fi.feet || 0), inches: Number(fi.inches || 0) }),
          );

  return (
    <>
      <input type="hidden" name={name} value={value} />
      {units === 'metric' ? (
        <div className="flex items-center gap-2">
          <Input
            inputMode="decimal"
            type="number"
            min={0}
            step={0.01}
            value={meters}
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
          onChange={(feet, inches) => setFi({ feet, inches })}
        />
      )}
    </>
  );
}

/** 短い長さの欄の刻み（cm のとき 1cm、インチのとき4分の1インチ） */
const SHORT_STEP_CM = 1;
const SHORT_STEP_IN = 0.25;

/**
 * 短い長さ（cm）。踏切板からの距離や支柱の位置。imperial はインチで受け、4分の1インチ刻み。
 * 範囲は cm で受けて、インチの欄にはその換算を出す
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
  const [shown, setShown] = useState(() =>
    // metric は持っている値のまま（インチで入れた -3.2 を -3 に丸めると、そのまま保存しても値が変わる）
    defaultCm === null ? '' : String(units === 'metric' ? defaultCm : cmToQuarterInches(defaultCm)),
  );
  const parsed = parse(shown);
  const value = parsed === null ? '' : String(units === 'metric' ? parsed : inchesToCm(parsed));
  const metric = units === 'metric';

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
