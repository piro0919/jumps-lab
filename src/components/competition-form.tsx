'use client';

// 線（components/progress.tsx）を出すため、移るのは @bprogress の useRouter で
import { useRouter } from '@bprogress/next/app';
import { useTranslations } from 'next-intl';
import { useActionState, useState } from 'react';
import { saveCompetitionAction } from '@/app/actions/competitions';
import { safely } from '@/lib/safe-action';
import { ActionForm } from '@/components/action-form';
import {
  ErrorText,
  Field,
  FieldLabel,
  Input,
  SEGMENTS,
  segmentClass,
  TextArea,
} from '@/components/layout-ui';
import { cn } from '@/lib/cn';
import { FormActions } from '@/components/form-actions';
import type { Competition } from '@/lib/data';
import { LONG_NOTE_MAX_LENGTH, URL_MAX_LENGTH } from '@/lib/limits';

/**
 * 大会の入力（/competitions/new と /competitions/[id]/edit の画面）。追加と編集で同じものを使う。
 * 保存したら大会の一覧へ戻る。入力は窓ではなく画面で行う（本人、2026-10-11「統一性がなくてわかりづらい」）
 */
export function CompetitionForm({
  initial,
  defaultDay,
  defaultEntryUrl,
}: {
  initial: Competition | null;
  defaultDay: string;
  /** 新しい大会の申し込みのサイトのはじめの値。日本の人は日本陸連の申し込みサイト、ほかの国は空 */
  defaultEntryUrl: string;
}) {
  const router = useRouter();
  const t = useTranslations('calendar');
  const tErrors = useTranslations('errors');
  const tProfile = useTranslations('profile');
  const [isTarget, setIsTarget] = useState(initial?.isTarget ?? false);
  const [state, action, pending] = useActionState(async (previous: unknown, formData: FormData) => {
    const result = await safely(() => saveCompetitionAction(null, formData));
    if (result?.ok) router.push('/competitions');
    return result;
  }, null);

  return (
    <ActionForm action={action} className="flex flex-col gap-4">
      <input type="hidden" name="id" value={initial?.id ?? ''} />
      <Field label={t('competitionName')} required={tProfile('required')}>
        <Input name="name" defaultValue={initial?.name ?? ''} required maxLength={200} />
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label={t('day')} required={tProfile('required')}>
          <Input name="day" type="date" defaultValue={initial?.day ?? defaultDay} required />
        </Field>
        <Field label={t('venue')}>
          <Input name="venue" defaultValue={initial?.venue ?? ''} maxLength={200} />
        </Field>
        <Field label={t('callRoomPlace')}>
          <Input name="callRoomPlace" defaultValue={initial?.callRoomPlace ?? ''} maxLength={200} />
        </Field>
        <Field label={t('callRoomTime')}>
          <Input name="callRoomTime" type="time" defaultValue={initial?.callRoomTime ?? ''} />
        </Field>
        <Field label={t('startTime')}>
          <Input name="startTime" type="time" defaultValue={initial?.startTime ?? ''} />
        </Field>
      </div>
      {/* 主目標の大会。今日のアドバイスが、この大会の前2週間を調整期にする */}
      <div className="flex flex-col gap-1.5">
        <input type="hidden" name="isTarget" value={String(isTarget)} />
        <FieldLabel label={t('target')} />
        {/* 1つだけ選ぶので切り替えの形（性別と同じ） */}
        <div
          role="radiogroup"
          aria-label={t('target')}
          className={cn(SEGMENTS, 'grid w-full grid-cols-2')}
        >
          {([false, true] as const).map((value) => (
            <button
              key={String(value)}
              type="button"
              role="radio"
              aria-checked={isTarget === value}
              onClick={() => setIsTarget(value)}
              className={cn(segmentClass(isTarget === value), 'px-2')}
            >
              {value ? t('targetBadge') : t('targetNo')}
            </button>
          ))}
        </div>
      </div>
      <Field label={t('entryUrl')}>
        <Input
          name="entryUrl"
          type="url"
          inputMode="url"
          defaultValue={initial ? (initial.entryUrl ?? '') : defaultEntryUrl}
          maxLength={URL_MAX_LENGTH}
        />
      </Field>
      <Field label={t('notes')}>
        <TextArea
          name="notes"
          defaultValue={initial?.notes ?? ''}
          maxLength={LONG_NOTE_MAX_LENGTH}
        />
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
