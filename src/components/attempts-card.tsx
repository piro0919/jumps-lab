'use client';

import { Plus, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useActionState, useState, useTransition } from 'react';
import { addAttemptAction, deleteAttemptAction } from '@/app/actions/today';
import { ActionForm } from '@/components/action-form';
import { ConfirmDialog } from '@/components/confirm-dialog';
import {
  Card,
  CardTitle,
  ErrorText,
  Field,
  Input,
  PrimaryButton,
  SubtleButton,
} from '@/components/layout-ui';
import { MarkInput } from '@/components/measure-inputs';
import { Drawer, DrawerContent, DrawerTitle } from '@/components/ui/drawer';
import type { Attempt } from '@/lib/data';
import { hasWind, type JumpEvent } from '@/lib/events';
import { formatMark, type Units } from '@/lib/units';

/** 記録を1本足す入力。下から出る窓（Drawer）の中に置く（Strong の記録の窓と同じ出方） */
function AddForm({
  day,
  event,
  units,
  onClose,
}: {
  day: string;
  event: JumpEvent;
  units: Units;
  onClose: () => void;
}) {
  const t = useTranslations('today');
  const tErrors = useTranslations('errors');
  const tProfile = useTranslations('profile');
  const [kind, setKind] = useState<'practice' | 'competition'>('practice');
  const [state, action, pending] = useActionState(async (previous: unknown, formData: FormData) => {
    const result = await addAttemptAction(null, formData);
    if (result?.ok) onClose();
    return result;
  }, null);

  return (
    <ActionForm
      action={action}
      className="flex flex-col gap-4 overflow-y-auto p-5 pb-[calc(20px+env(safe-area-inset-bottom))]"
    >
      <DrawerTitle className="text-lg font-bold">{t('addAttempt')}</DrawerTitle>
      <input type="hidden" name="day" value={day} />
      <input type="hidden" name="kind" value={kind} />
      <div className="grid grid-cols-2 gap-1 rounded-xl bg-muted p-1">
        {(['practice', 'competition'] as const).map((value) => (
          <button
            key={value}
            type="button"
            aria-pressed={kind === value}
            onClick={() => setKind(value)}
            className={`h-9 rounded-lg text-sm font-semibold ${
              kind === value ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'
            }`}
          >
            {t(value)}
          </button>
        ))}
      </div>
      <Field label={t('mark')} required={tProfile('required')}>
        <MarkInput name="markM" units={units} autoFocus />
      </Field>
      {hasWind(event) && (
        <Field label={t('wind')}>
          <Input name="windMs" type="number" inputMode="decimal" step={0.1} min={-20} max={20} />
        </Field>
      )}
      <Field label={t('attemptNote')}>
        <Input name="note" maxLength={500} />
      </Field>
      <ErrorText>{state?.ok === false ? tErrors(state.error as 'generic') : null}</ErrorText>
      <div className="grid grid-cols-2 gap-3">
        <SubtleButton type="button" onClick={onClose} className="h-11 rounded-xl">
          {t('cancel')}
        </SubtleButton>
        <PrimaryButton type="submit" disabled={pending}>
          {t('add')}
        </PrimaryButton>
      </div>
    </ActionForm>
  );
}

/**
 * その日の記録。1本ずつ並べ、いちばん良い1本に印を付ける。
 * 追加は下から出る窓で、削除は確かめてから
 */
export function AttemptsCard({
  day,
  event,
  units,
  attempts,
}: {
  day: string;
  event: JumpEvent;
  units: Units;
  attempts: Attempt[];
}) {
  const t = useTranslations('today');
  const [adding, setAdding] = useState(false);
  // 消す前に確かめている記録
  const [removing, setRemoving] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const best = attempts.reduce<number | null>(
    (top, attempt) => (top === null || attempt.markM > top ? attempt.markM : top),
    null,
  );

  return (
    <Card>
      <CardTitle
        action={
          <SubtleButton type="button" onClick={() => setAdding(true)}>
            <Plus aria-hidden className="size-4" />
            {t('add')}
          </SubtleButton>
        }
      >
        {t('attempts')}
      </CardTitle>
      {attempts.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('noAttempts')}</p>
      ) : (
        <ol className="flex flex-col divide-y divide-border">
          {attempts.map((attempt, index) => (
            <li key={attempt.id} className="flex items-center gap-3 py-2.5">
              <span className="w-5 text-sm text-muted-foreground tabular-nums">{index + 1}</span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="flex items-baseline gap-2">
                  <span className="text-lg font-bold tabular-nums">
                    {formatMark(attempt.markM, units)}
                  </span>
                  {attempt.markM === best && (
                    <span className="rounded-full bg-secondary px-2 text-xs font-semibold text-primary">
                      {t('best')}
                    </span>
                  )}
                </span>
                <span className="truncate text-xs text-muted-foreground">
                  {[
                    t(attempt.kind),
                    attempt.windMs === null
                      ? null
                      : `${attempt.windMs > 0 ? '+' : ''}${attempt.windMs.toFixed(1)} m/s`,
                    attempt.note,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
              </span>
              <button
                type="button"
                aria-label={t('delete')}
                onClick={() => setRemoving(attempt.id)}
                className="flex size-9 items-center justify-center rounded-full text-muted-foreground active:bg-accent"
              >
                <Trash2 aria-hidden className="size-4" />
              </button>
            </li>
          ))}
        </ol>
      )}

      <Drawer open={adding} onOpenChange={setAdding}>
        <DrawerContent className="mx-auto max-w-lg">
          <AddForm day={day} event={event} units={units} onClose={() => setAdding(false)} />
        </DrawerContent>
      </Drawer>
      <ConfirmDialog
        open={removing !== null}
        title={t('deleteConfirm')}
        onOpenChange={(open) => {
          if (!open) setRemoving(null);
        }}
        onConfirm={() => {
          const id = removing;
          if (id) startTransition(() => deleteAttemptAction(id));
        }}
      />
    </Card>
  );
}
