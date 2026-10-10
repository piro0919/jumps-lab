'use client';

// 線（components/progress.tsx）を出すため、移るのは @bprogress の useRouter で
import { useRouter } from '@bprogress/next/app';
import { useTranslations } from 'next-intl';
import { useActionState, useState } from 'react';
import { saveAttemptAction } from '@/app/actions/today';
import { ActionForm } from '@/components/action-form';
import { ErrorText, Field, FieldLabel, segmentClass, TextArea } from '@/components/layout-ui';
import { MarkInput, WindInput } from '@/components/measure-inputs';
import { FormActions } from '@/components/form-actions';
import { cn } from '@/lib/cn';
import type { Attempt } from '@/lib/data';
import { hasWind, type JumpEvent } from '@/lib/events';
import { NOTE_MAX_LENGTH } from '@/lib/limits';
import type { Units } from '@/lib/units';

/** 2つ以上から1つを選ぶ、横並びの切り替え（練習・大会、種目） */
export function Segmented<T extends string>({
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
          className={cn(segmentClass(value === option), 'truncate px-1')}
        >
          {label(option)}
        </button>
      ))}
    </div>
  );
}

/**
 * 試技を1本足す・直す入力（/log/[day]/new と /attempts/[id]/edit の画面）。種目はここで選ぶ。
 * 足すときのはじめの種目は、その日に最後に足した種目。保存したら、その日の画面へ戻る。入力は窓ではなく画面で行う（本人、2026-10-11「統一性がなくてわかりづらい」）
 */
export function AttemptForm({
  day,
  events,
  initialEvent,
  units,
  backHref,
  initial,
}: {
  day: string;
  events: JumpEvent[];
  initialEvent: JumpEvent;
  units: Units;
  /** 戻る先（その日の画面） */
  backHref: string;
  /** 直すときの元の試技。無ければ足す */
  initial?: Attempt;
}) {
  const t = useTranslations('today');
  const tEvents = useTranslations('events');
  const tErrors = useTranslations('errors');
  const tProfile = useTranslations('profile');
  const router = useRouter();
  const [event, setEvent] = useState<JumpEvent>(initialEvent);
  const [kind, setKind] = useState<'practice' | 'competition'>(initial?.kind ?? 'practice');
  const [state, action, pending] = useActionState(async (previous: unknown, formData: FormData) => {
    const result = await saveAttemptAction(null, formData);
    if (result?.ok) router.push(backHref);
    return result;
  }, null);

  return (
    <ActionForm action={action} className="flex flex-col gap-4">
      <input type="hidden" name="id" value={initial?.id ?? ''} />
      <input type="hidden" name="day" value={day} />
      <input type="hidden" name="event" value={event} />
      <input type="hidden" name="kind" value={kind} />
      {/* 切り替えにも、ほかの欄と同じく名前を付ける（名前の無い欄が混ざっていた。本人、2026-10-11） */}
      {events.length > 1 && (
        <div className="flex flex-col gap-1.5">
          <FieldLabel label={tProfile('events')} />
          <Segmented options={events} value={event} label={(e) => tEvents(e)} onChange={setEvent} />
        </div>
      )}
      <div className="flex flex-col gap-1.5">
        <FieldLabel label={t('kind')} />
        <Segmented
          options={['practice', 'competition'] as const}
          value={kind}
          label={(k) => t(k)}
          onChange={setKind}
        />
      </div>
      <Field label={t('mark')} required={tProfile('required')}>
        <MarkInput name="markM" units={units} defaultMeters={initial?.markM ?? null} autoFocus />
      </Field>
      {hasWind(event) && (
        <Field label={t('wind')}>
          <WindInput name="windMs" defaultValue={initial?.windMs ?? null} />
        </Field>
      )}
      <Field label={t('attemptNote')}>
        <TextArea name="note" maxLength={NOTE_MAX_LENGTH} defaultValue={initial?.note ?? ''} />
      </Field>
      <FormActions
        label={t('save')}
        pending={pending}
        message={
          <ErrorText>{state?.ok === false ? tErrors(state.error as 'generic') : null}</ErrorText>
        }
      />
    </ActionForm>
  );
}
