'use client';

import { useTranslations } from 'next-intl';
import { ActionForm } from '@/components/action-form';
import { useActionState, useState } from 'react';
import { saveTargetAction } from '@/app/actions/targets';
import { MarkInput } from '@/components/measure-inputs';
import { PrimaryButton, SubtleButton } from '@/components/ui';
import { formatMark, type Units } from '@/lib/units';

/**
 * 目標やベストの1行。押すとその場で入力欄に変わる（プロトタイプの「タップして入力」）。
 * shown は記録から出した値と手で入れた値の高い方、manual は手で入れた値だけ
 */
export function MarkEditor({
  field,
  label,
  shown,
  manual,
  units,
  large = false,
}: {
  field: 'seasonGoalM' | 'manualPbM' | 'manualSbM' | 'manualPracticeBestM';
  label: string;
  shown: number | null;
  manual: number | null;
  units: Units;
  large?: boolean;
}) {
  const t = useTranslations('home');
  const tProfile = useTranslations('profile');
  const [editing, setEditing] = useState(false);
  const [, action, pending] = useActionState(async (previous: unknown, formData: FormData) => {
    const result = await saveTargetAction(null, formData);
    if (result?.ok) setEditing(false);
    return result;
  }, null);

  if (editing) {
    return (
      <ActionForm action={action} className="flex flex-col gap-2">
        <span className="text-[13px] font-medium text-sub">{label}</span>
        <input type="hidden" name="field" value={field} />
        <MarkInput name="markM" units={units} defaultMeters={manual} autoFocus />
        <div className="flex justify-end gap-2">
          {manual !== null && (
            <SubtleButton type="submit" name="markM" value="" disabled={pending} formNoValidate>
              {t('clear')}
            </SubtleButton>
          )}
          <PrimaryButton type="submit" disabled={pending} className="h-9 px-4 text-sm">
            {tProfile('save')}
          </PrimaryButton>
        </div>
      </ActionForm>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className="flex w-full items-baseline justify-between gap-3 text-left"
    >
      <span className="text-[13px] font-medium text-sub">{label}</span>
      <span
        className={`font-bold tabular-nums ${large ? 'text-[34px] leading-none' : 'text-xl'} ${
          shown === null ? 'text-line' : ''
        }`}
      >
        {shown === null ? '—' : formatMark(shown, units)}
      </span>
    </button>
  );
}
