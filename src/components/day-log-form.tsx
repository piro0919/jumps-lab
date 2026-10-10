'use client';

import { useTranslations } from 'next-intl';
import { ActionForm } from '@/components/action-form';
import { useActionState, useState } from 'react';
import { saveDayLogAction } from '@/app/actions/today';
import { Card, CardTitle, ErrorText, Field, Input, PrimaryButton, TextArea } from '@/components/ui';
import type { DayLog } from '@/lib/data';

function Slider({
  name,
  label,
  min,
  max,
  step,
  initial,
  suffix,
}: {
  name: string;
  label: string;
  min: number;
  max: number;
  step: number;
  initial: number;
  suffix: string;
}) {
  const [value, setValue] = useState(initial);
  return (
    <label className="flex flex-col gap-1.5">
      <span className="flex items-baseline justify-between text-[13px] font-medium text-sub">
        {label}
        <span className="text-[15px] font-bold text-ink tabular-nums">
          {value}
          {suffix}
        </span>
      </span>
      <input
        type="range"
        name={name}
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => setValue(Number(e.target.value))}
        className="h-6 w-full accent-accent"
      />
    </label>
  );
}

/**
 * その日の体調・ケガ・練習メモ。まとめて1つのボタンで保存する（欄ごとに保存しない）。
 * 既定の値はプロトタイプと同じ（体調 7、疲労 4、睡眠 7 時間）
 */
export function DayLogForm({ day, log }: { day: string; log: DayLog | null }) {
  const t = useTranslations('today');
  const tUnits = useTranslations('units');
  const tErrors = useTranslations('errors');
  const tProfile = useTranslations('profile');
  const [state, action, pending] = useActionState(saveDayLogAction, null);

  return (
    <ActionForm action={action} key={day}>
      <input type="hidden" name="day" value={day} />
      <Card className="flex flex-col gap-4">
        <CardTitle>{t('condition')}</CardTitle>
        <Slider
          name="condition"
          label={t('physical')}
          min={1}
          max={10}
          step={1}
          initial={log?.condition ?? 7}
          suffix="/10"
        />
        <Slider
          name="fatigue"
          label={t('fatigue')}
          min={1}
          max={10}
          step={1}
          initial={log?.fatigue ?? 4}
          suffix="/10"
        />
        <Slider
          name="sleepHours"
          label={t('sleep')}
          min={0}
          max={12}
          step={0.5}
          initial={log?.sleepHours ?? 7}
          suffix={tUnits('hours')}
        />
        <Field label={t('injury')}>
          <Input name="injury" defaultValue={log?.injury ?? ''} maxLength={500} />
        </Field>
        <Field label={t('note')}>
          <TextArea name="note" defaultValue={log?.note ?? ''} maxLength={2000} />
        </Field>
        <div className="flex items-center justify-end gap-3">
          <ErrorText>{state?.ok === false ? tErrors('generic') : null}</ErrorText>
          {state?.ok && !pending && <span className="text-sm text-good">{tProfile('saved')}</span>}
          <PrimaryButton type="submit" disabled={pending}>
            {t('save')}
          </PrimaryButton>
        </div>
      </Card>
    </ActionForm>
  );
}
