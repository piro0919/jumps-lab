'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useActionState } from 'react';
import { saveTargetsAction } from '@/app/actions/targets';
import { ActionForm } from '@/components/action-form';
import { ErrorText, Field } from '@/components/layout-ui';
import { MarkInput } from '@/components/measure-inputs';
import { Button, buttonVariants } from '@/components/ui/button';
import type { JumpEvent } from '@/lib/events';
import type { Units } from '@/lib/units';

type TargetField = 'manualPbM' | 'manualSbM' | 'manualPracticeBestM' | 'seasonGoalM';

/**
 * 1種目の目標とベストを直す入力（/targets/[event] の画面）。4つをまとめて保存してホームへ戻る。
 * 欄を空にして保存すると、手で入れた値を消す（記録から出した値に戻る）。
 * ホームで押した欄（focus）に、はじめから入る
 */
export function TargetsForm({
  event,
  values,
  units,
  focus,
}: {
  event: JumpEvent;
  values: Record<TargetField, number | null>;
  units: Units;
  focus: TargetField;
}) {
  const t = useTranslations('home');
  const tToday = useTranslations('today');
  const tProfile = useTranslations('profile');
  const tErrors = useTranslations('errors');
  const [state, action, pending] = useActionState(saveTargetsAction, null);

  const fields: { name: TargetField; label: string }[] = [
    { name: 'manualPbM', label: t('pb') },
    { name: 'manualSbM', label: t('sb') },
    { name: 'manualPracticeBestM', label: t('practiceBest') },
    { name: 'seasonGoalM', label: t('goal') },
  ];

  return (
    <ActionForm action={action} className="flex flex-col gap-4">
      <input type="hidden" name="event" value={event} />
      {fields.map(({ name, label }) => (
        <Field key={name} label={label}>
          <MarkInput
            name={name}
            units={units}
            defaultMeters={values[name]}
            autoFocus={name === focus}
          />
        </Field>
      ))}
      <ErrorText>{state?.ok === false ? tErrors('generic') : null}</ErrorText>
      <div className="grid grid-cols-2 gap-3">
        <Link href="/" className={buttonVariants({ variant: 'secondary' })}>
          {tToday('cancel')}
        </Link>
        <Button type="submit" disabled={pending}>
          {tProfile('save')}
        </Button>
      </div>
    </ActionForm>
  );
}
