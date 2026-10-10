'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Input } from '@/components/layout-ui';
import {
  cmToFeetInches,
  feetInchesToCm,
  feetInchesToMeters,
  kgToLb,
  lbToKg,
  metersToFeetInches,
  type Units,
} from '@/lib/units';

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
}: {
  feet: string;
  inches: string;
  inchStep: number;
  onChange: (feet: string, inches: string) => void;
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
          onChange={(feet, inches) => setFi({ feet, inches })}
        />
      )}
    </>
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
          step={units === 'metric' ? 0.1 : 1}
          value={shown}
          onChange={(e) => setShown(e.target.value)}
        />
        <Unit>{units === 'metric' ? t('kg') : t('lb')}</Unit>
      </div>
    </>
  );
}
