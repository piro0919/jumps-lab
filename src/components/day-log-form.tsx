'use client';

// 線（components/progress.tsx）を出すため、移るのは @bprogress の useRouter で
import { useRouter } from '@bprogress/next/app';
import { useTranslations } from 'next-intl';
import { ActionForm } from '@/components/action-form';
import { useActionState, useState } from 'react';
import { saveDayLogAction } from '@/app/actions/today';
import { safely } from '@/lib/safe-action';
import { ErrorText, Field, LABEL, TextArea } from '@/components/layout-ui';
import { FormActions } from '@/components/form-actions';
import type { DayLog } from '@/lib/data';
import { LONG_NOTE_MAX_LENGTH, NOTE_MAX_LENGTH, SCALE_MAX } from '@/lib/limits';

/** まだ入れていない日に、つまみを置いておく位置（体調・疲れ・睡眠時間） */
const DEFAULT_CONDITION = 7;
const DEFAULT_FATIGUE = 4;
const DEFAULT_SLEEP_HOURS = 7;

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
      <span className={`flex items-baseline justify-between ${LABEL}`}>
        {label}
        <span className="text-base font-bold text-foreground tabular-nums">
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
        className="h-6 w-full accent-primary"
      />
    </label>
  );
}

/**
 * その日の体調・ケガ・練習メモの入力（/log/[day]/condition の画面）。まとめて1つのボタンで保存し、その日の画面へ戻る。
 * 日の画面は見るだけにして、直すのはこの画面（本人、2026-10-11。詳細と編集を兼ねていてわかりづらかった）。
 * 既定の値はプロトタイプと同じ（体調 7、疲労 4、睡眠 7 時間）
 */
export function DayLogForm({
  day,
  log,
  backHref,
}: {
  day: string;
  log: DayLog | null;
  /** 戻る先（その日の画面） */
  backHref: string;
}) {
  const t = useTranslations('today');
  const tUnits = useTranslations('units');
  const tErrors = useTranslations('errors');
  const router = useRouter();
  const [state, action, pending] = useActionState(async (previous: unknown, formData: FormData) => {
    const result = await safely(() => saveDayLogAction(null, formData));
    if (result?.ok) router.push(backHref);
    return result;
  }, null);

  return (
    <ActionForm action={action} className="flex flex-col gap-4">
      <input type="hidden" name="day" value={day} />
      <Slider
        name="condition"
        label={t('physical')}
        min={1}
        max={SCALE_MAX}
        step={1}
        initial={log?.condition ?? DEFAULT_CONDITION}
        suffix="/10"
      />
      <Slider
        name="fatigue"
        label={t('fatigue')}
        min={1}
        max={SCALE_MAX}
        step={1}
        initial={log?.fatigue ?? DEFAULT_FATIGUE}
        suffix="/10"
      />
      <Slider
        name="sleepHours"
        label={t('sleep')}
        min={0}
        max={12}
        step={0.5}
        initial={log?.sleepHours ?? DEFAULT_SLEEP_HOURS}
        suffix={tUnits('hours')}
      />
      <Field label={t('injury')}>
        <TextArea name="injury" defaultValue={log?.injury ?? ''} maxLength={NOTE_MAX_LENGTH} />
      </Field>
      <Field label={t('note')}>
        <TextArea name="note" defaultValue={log?.note ?? ''} maxLength={LONG_NOTE_MAX_LENGTH} />
      </Field>
      <FormActions
        label={t('save')}
        pending={pending}
        message={<ErrorText>{state?.ok === false ? tErrors('generic') : null}</ErrorText>}
      />
    </ActionForm>
  );
}
