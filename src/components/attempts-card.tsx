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
  segmentClass,
} from '@/components/layout-ui';
import { cn } from 'cn';
import { MarkInput } from '@/components/measure-inputs';
import { Drawer, DrawerContent, DrawerTitle } from '@/components/ui/drawer';
import type { Attempt } from '@/lib/data';
import { hasWind, isWindAided, type JumpEvent } from '@/lib/events';
import { formatMark, type Units } from '@/lib/units';

/** 2つ以上から1つを選ぶ、横並びの切り替え（練習・大会、種目） */
function Segmented<T extends string>({
  options,
  value,
  label,
  onChange,
}: {
  options: readonly T[];
  value: T;
  label: (option: T) => string;
  onChange: (option: T) => void;
}) {
  return (
    <div
      className="grid gap-1 rounded-full bg-muted p-1"
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      {options.map((option) => (
        <button
          key={option}
          type="button"
          aria-pressed={value === option}
          onClick={() => onChange(option)}
          className={cn(segmentClass(value === option), 'h-9 truncate px-1')}
        >
          {label(option)}
        </button>
      ))}
    </div>
  );
}

/**
 * 記録を1本足す入力。下から出る窓（Drawer）の中に置く（Strong の記録の窓と同じ出方）。
 * 種目はここで選ぶ。はじめはその日に最後に足した種目
 */
function AddForm({
  day,
  events,
  initialEvent,
  units,
  onClose,
}: {
  day: string;
  events: JumpEvent[];
  initialEvent: JumpEvent;
  units: Units;
  onClose: () => void;
}) {
  const t = useTranslations('today');
  const tEvents = useTranslations('events');
  const tErrors = useTranslations('errors');
  const tProfile = useTranslations('profile');
  const [event, setEvent] = useState<JumpEvent>(initialEvent);
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
      <input type="hidden" name="event" value={event} />
      <input type="hidden" name="kind" value={kind} />
      {events.length > 1 && (
        <Segmented options={events} value={event} label={(e) => tEvents(e)} onChange={setEvent} />
      )}
      <Segmented
        options={['practice', 'competition'] as const}
        value={kind}
        label={(k) => t(k)}
        onChange={setKind}
      />
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
 * その日の記録。種目ごとにまとめて1本ずつ並べ、種目ごとにいちばん良い1本に印を付ける。
 * 並びは本人の選んだ種目の順。種目から外した種目の記録も消さずに後ろに出す。
 * 追加は下から出る窓で、削除は確かめてから
 */
export function AttemptsCard({
  day,
  events,
  units,
  attempts,
}: {
  day: string;
  /** 本人の選んだ種目 */
  events: JumpEvent[];
  units: Units;
  /** その日の記録（全種目）。古い順 */
  attempts: Attempt[];
}) {
  const t = useTranslations('today');
  const tEvents = useTranslations('events');
  const [adding, setAdding] = useState(false);
  // 消す前に確かめている記録
  const [removing, setRemoving] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const shown = [
    ...events,
    ...new Set(attempts.map((a) => a.event).filter((e) => !events.includes(e))),
  ];
  const groups = shown
    .map((event) => ({ event, rows: attempts.filter((a) => a.event === event) }))
    .filter((group) => group.rows.length > 0);
  const lastEvent = attempts.at(-1)?.event;
  const initialEvent = lastEvent && events.includes(lastEvent) ? lastEvent : events[0]!;

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
      {groups.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('noAttempts')}</p>
      ) : (
        <div className="flex flex-col gap-4">
          {groups.map(({ event, rows }) => {
            const best = Math.max(...rows.map((r) => r.markM));
            return (
              <section key={event}>
                <h3 className="text-[13px] font-semibold text-muted-foreground">
                  {tEvents(event)}
                </h3>
                <ol className="flex flex-col divide-y divide-border">
                  {rows.map((attempt, index) => (
                    <li key={attempt.id} className="flex items-center gap-3 py-2.5">
                      <span className="w-5 text-sm text-muted-foreground tabular-nums">
                        {index + 1}
                      </span>
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="flex items-baseline gap-2">
                          <span className="font-display text-[26px] leading-none font-extrabold italic tabular-nums">
                            {formatMark(attempt.markM, units)}
                          </span>
                          {attempt.markM === best && (
                            <span className="rounded-full bg-secondary px-2 text-xs font-semibold text-primary">
                              {t('best')}
                            </span>
                          )}
                          {/* 追い風 2.0 m/s 超え。PB・SB には数えていない */}
                          {isWindAided(attempt.windMs) && (
                            <span className="rounded-full bg-muted px-2 text-xs font-semibold text-muted-foreground">
                              {t('windAided')}
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
              </section>
            );
          })}
        </div>
      )}

      <Drawer open={adding} onOpenChange={setAdding}>
        <DrawerContent className="mx-auto max-w-lg">
          <AddForm
            day={day}
            events={events}
            initialEvent={initialEvent}
            units={units}
            onClose={() => setAdding(false)}
          />
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
