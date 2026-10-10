'use client';

import { useTranslations } from 'next-intl';
import { ActionForm } from '@/components/action-form';
import { useActionState, useState } from 'react';
import { saveTargetAction } from '@/app/actions/targets';
import { MarkInput } from '@/components/measure-inputs';
import { Stat } from '@/components/layout-ui';
import { Button } from '@/components/ui/button';
import type { JumpEvent } from '@/lib/events';
import { formatMarkParts, type Units } from '@/lib/units';

/**
 * 目標やベストの1行。押すとその場で入力欄に変わる（プロトタイプの「タップして入力」）。
 * shown は記録から出した値と手で入れた値の高い方、manual は手で入れた値だけ
 */
export function MarkEditor({
  event,
  field,
  label,
  shown,
  manual,
  units,
  size = 'md',
  inverse = false,
}: {
  event: JumpEvent;
  field: 'seasonGoalM' | 'manualPbM' | 'manualSbM' | 'manualPracticeBestM';
  label: string;
  shown: number | null;
  manual: number | null;
  units: Units;
  size?: 'giant' | 'hero' | 'md' | 'sm';
  /** 色付きの地の上（字を白に） */
  inverse?: boolean;
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
      <ActionForm
        action={action}
        className="flex flex-col gap-2 rounded-2xl bg-card p-3 text-card-foreground"
      >
        <span className="text-[13px] font-medium text-muted-foreground">{label}</span>
        <input type="hidden" name="event" value={event} />
        <input type="hidden" name="field" value={field} />
        <MarkInput name="markM" units={units} defaultMeters={manual} autoFocus />
        <div className="flex justify-end gap-2">
          {manual !== null && (
            <Button
              variant="secondary"
              size="sm"
              type="submit"
              name="markM"
              value=""
              disabled={pending}
              formNoValidate
            >
              {t('clear')}
            </Button>
          )}
          <Button size="sm" type="submit" disabled={pending}>
            {tProfile('save')}
          </Button>
        </div>
      </ActionForm>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className={`w-full rounded-xl text-left ${inverse ? 'hover:bg-white/10' : 'hover:bg-accent/60'}`}
    >
      <Stat
        value={shown === null ? null : formatMarkParts(shown, units)}
        label={label}
        size={size}
        inverse={inverse}
      />
    </button>
  );
}
