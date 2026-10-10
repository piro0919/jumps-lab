'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useActionState, useState } from 'react';
import { addAttemptAction } from '@/app/actions/today';
import { ActionForm } from '@/components/action-form';
import { ErrorText, Field, Input, segmentClass } from '@/components/layout-ui';
import { MarkInput } from '@/components/measure-inputs';
import { Button, buttonVariants } from '@/components/ui/button';
import { cn } from 'cn';
import { hasWind, type JumpEvent } from '@/lib/events';
import type { Units } from '@/lib/units';

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
          className={cn(segmentClass(value === option), 'truncate px-1')}
        >
          {label(option)}
        </button>
      ))}
    </div>
  );
}

/**
 * 試技を1本足す入力（/log/[day]/new の画面）。種目はここで選ぶ。はじめはその日に最後に足した種目。
 * 足したら、その日の画面へ戻る。入力は窓ではなく画面で行う（本人、2026-10-11「統一性がなくてわかりづらい」）
 */
export function AttemptForm({
  day,
  events,
  initialEvent,
  units,
  backHref,
}: {
  day: string;
  events: JumpEvent[];
  initialEvent: JumpEvent;
  units: Units;
  /** 戻る先（その日の画面） */
  backHref: string;
}) {
  const t = useTranslations('today');
  const tEvents = useTranslations('events');
  const tErrors = useTranslations('errors');
  const tProfile = useTranslations('profile');
  const router = useRouter();
  const [event, setEvent] = useState<JumpEvent>(initialEvent);
  const [kind, setKind] = useState<'practice' | 'competition'>('practice');
  const [state, action, pending] = useActionState(async (previous: unknown, formData: FormData) => {
    const result = await addAttemptAction(null, formData);
    if (result?.ok) router.push(backHref);
    return result;
  }, null);

  return (
    <ActionForm action={action} className="flex flex-col gap-4">
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
        <Link href={backHref} className={buttonVariants({ variant: 'secondary' })}>
          {t('cancel')}
        </Link>
        <Button type="submit" disabled={pending}>
          {t('add')}
        </Button>
      </div>
    </ActionForm>
  );
}
