'use client';

import { useTranslations } from 'next-intl';
import { ActionForm } from '@/components/action-form';
import { useActionState, useState } from 'react';
import { saveTargetAction } from '@/app/actions/targets';
import { MarkInput } from '@/components/measure-inputs';
import { Badge, ErrorText, Field, Stat } from '@/components/layout-ui';
import { Button } from '@/components/ui/button';
import { Drawer, DrawerContent, DrawerTitle } from '@/components/ui/drawer';
import { EVENT_BG, type JumpEvent } from '@/lib/events';
import { formatMarkParts, type Units } from '@/lib/units';

/**
 * 目標やベストの1つ。押すと下から出る窓で直す（記録を足す窓と同じ出方）。
 * はじめはカードの中でその場の入力欄に変えていたが、3つ並んだ狭い欄ではボタンがはみ出し、
 * 閉じる手段も無かった（本人、2026-10-11）。窓は外を押すか Esc、キャンセルで保存せずに閉じる。
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
  const tToday = useTranslations('today');
  const tEvents = useTranslations('events');
  const tErrors = useTranslations('errors');
  const [editing, setEditing] = useState(false);
  const [state, action, pending] = useActionState(async (previous: unknown, formData: FormData) => {
    const result = await saveTargetAction(null, formData);
    if (result?.ok) setEditing(false);
    return result;
  }, null);

  return (
    <>
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

      <Drawer open={editing} onOpenChange={setEditing}>
        <DrawerContent className="mx-auto max-w-lg">
          <ActionForm
            action={action}
            className="flex flex-col gap-4 p-5 pb-[calc(20px+env(safe-area-inset-bottom))]"
          >
            <div className="flex items-center gap-2">
              <DrawerTitle className="text-lg font-extrabold">{label}</DrawerTitle>
              <Badge tone="solid" className={EVENT_BG[event]}>
                {tEvents(event)}
              </Badge>
            </div>
            <input type="hidden" name="event" value={event} />
            <input type="hidden" name="field" value={field} />
            <Field label={label}>
              <MarkInput name="markM" units={units} defaultMeters={manual} autoFocus />
            </Field>
            <ErrorText>{state?.ok === false ? tErrors('generic') : null}</ErrorText>
            <div className={`grid gap-3 ${manual !== null ? 'grid-cols-3' : 'grid-cols-2'}`}>
              {/* 手で入れた値があるときだけ、消す（記録から出した値に戻す）ボタンを出す */}
              {manual !== null && (
                <Button
                  variant="destructive"
                  type="submit"
                  name="markM"
                  value=""
                  disabled={pending}
                  formNoValidate
                >
                  {t('clear')}
                </Button>
              )}
              <Button variant="secondary" type="button" onClick={() => setEditing(false)}>
                {tToday('cancel')}
              </Button>
              <Button type="submit" disabled={pending}>
                {tProfile('save')}
              </Button>
            </div>
          </ActionForm>
        </DrawerContent>
      </Drawer>
    </>
  );
}
