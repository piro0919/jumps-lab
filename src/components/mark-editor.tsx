'use client';

import { useTranslations } from 'next-intl';
import { ActionForm } from '@/components/action-form';
import { useActionState, useState } from 'react';
import { saveTargetAction } from '@/app/actions/targets';
import { safely } from '@/lib/safe-action';
import { MarkInput } from '@/components/measure-inputs';
import { Badge, ErrorText, Stat } from '@/components/layout-ui';
import { Sheet } from '@/components/sheet';
import { Button } from '@/components/ui/button';
import { EVENT_BG, type JumpEvent } from '@/lib/events';
import { formatMarkParts, type Units } from '@/lib/units';

/**
 * 目標やベストの1つ。押すと窓で直す（記録を足す窓と同じ。スマホは下から、PC は中央に出る）。
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
    const result = await safely(() => saveTargetAction(null, formData));
    if (result?.ok) setEditing(false);
    return result;
  }, null);

  return (
    <>
      {/* 押せる範囲と、指を乗せたときの地は、数字の周りに 8px の余白を取る。外側は同じだけ縮めて、
          並びの位置は変えない（地が数字にぴったり付いていた。本人、2026-10-11） */}
      <button
        type="button"
        onClick={() => setEditing(true)}
        className={`-m-2 block w-bleed rounded-xl p-2 text-left ${inverse ? 'hover:bg-white/10' : 'hover:bg-accent/60'}`}
      >
        <Stat
          value={shown === null ? null : formatMarkParts(shown, units)}
          label={label}
          size={size}
          inverse={inverse}
        />
      </button>

      <Sheet
        open={editing}
        onOpenChange={setEditing}
        title={
          <>
            {label}
            <Badge tone="solid" className={EVENT_BG[event]}>
              {tEvents(event)}
            </Badge>
          </>
        }
      >
        <ActionForm action={action} className="flex flex-col gap-4">
          <input type="hidden" name="event" value={event} />
          <input type="hidden" name="field" value={field} />
          {/* 欄の名前は窓の題と同じなので、画面には出さず読み上げにだけ渡す（PB が2回出ていた。本人、2026-10-11） */}
          <label>
            <span className="sr-only">{label}</span>
            <MarkInput name="markM" units={units} defaultMeters={manual} autoFocus />
          </label>
          <ErrorText>{state?.ok === false ? tErrors('generic') : null}</ErrorText>
          <div className={`grid gap-3 ${manual !== null ? 'grid-cols-3' : 'grid-cols-2'}`}>
            {/* 手で入れた値があるときだけ、消す（記録から出した値に戻す）ボタンを出す */}
            {manual !== null && (
              <Button
                variant="secondary"
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
      </Sheet>
    </>
  );
}
