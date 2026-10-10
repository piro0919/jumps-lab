'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ActionForm } from '@/components/action-form';
import { useActionState, useState } from 'react';
import { saveDayLogAction } from '@/app/actions/today';
import { ErrorText, Field, Input, LABEL, TextArea } from '@/components/layout-ui';
import { Button, buttonVariants } from '@/components/ui/button';
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
    const result = await saveDayLogAction(null, formData);
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
      <ErrorText>{state?.ok === false ? tErrors('generic') : null}</ErrorText>
      <div className="grid grid-cols-2 gap-3">
        <Link href={backHref} className={buttonVariants({ variant: 'secondary' })}>
          {t('cancel')}
        </Link>
        <Button type="submit" disabled={pending}>
          {t('save')}
        </Button>
      </div>
    </ActionForm>
  );
}
