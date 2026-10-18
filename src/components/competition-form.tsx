'use client';

// 線（components/progress.tsx）を出すため、移るのは @bprogress の useRouter で
import { useRouter } from '@bprogress/next/app';
import { useTranslations } from 'next-intl';
import { useActionState, useState } from 'react';
import { saveCompetitionAction } from '@/app/actions/competitions';
import { safely } from '@/lib/safe-action';
import { ActionForm } from '@/components/action-form';
import { ErrorText, Field, Input, TextArea } from '@/components/layout-ui';
import { cn } from '@/lib/cn';
import { FormActions } from '@/components/form-actions';
import type { Competition } from '@/lib/data';
import { LONG_NOTE_MAX_LENGTH, URL_MAX_LENGTH } from '@/lib/limits';
import type { ImportedMeet } from '@/lib/meet-import';

/**
 * 大会の入力（/competitions/new と /competitions/[id]/edit の画面）。追加と編集で同じものを使う。
 * 保存したら大会の一覧へ戻る。入力は窓ではなく画面で行う（本人、2026-10-11「統一性がなくてわかりづらい」）
 */
export function CompetitionForm({
  initial,
  draft = null,
  defaultDay,
  defaultEntryUrl,
  returnTo = '/competitions',
}: {
  initial: Competition | null;
  /** 取り込んだ大会の下書き（src/lib/meet-import.ts）。新しい大会のはじめの値にする */
  draft?: ImportedMeet | null;
  defaultDay: string;
  /** 新しい大会の申し込みのサイトのはじめの値。日本の人は日本陸連の申し込みサイト、ほかの国は空 */
  defaultEntryUrl: string;
  /** 保存したあとに移る画面。取り込みから来たときは取り込みの一覧へ戻る */
  returnTo?: string;
}) {
  const values = initial ?? draft;
  const router = useRouter();
  const t = useTranslations('calendar');
  const tErrors = useTranslations('errors');
  const tProfile = useTranslations('profile');
  const [isTarget, setIsTarget] = useState(initial?.isTarget ?? false);
  const [state, action, pending] = useActionState(async (previous: unknown, formData: FormData) => {
    const result = await safely(() => saveCompetitionAction(null, formData));
    if (result?.ok) router.push(returnTo);
    return result;
  }, null);

  return (
    <ActionForm action={action} className="flex flex-col gap-4">
      <input type="hidden" name="id" value={initial?.id ?? ''} />
      <Field label={t('competitionName')} required={tProfile('required')}>
        <Input name="name" defaultValue={values?.name ?? ''} required maxLength={200} />
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label={t('day')} required={tProfile('required')}>
          <Input name="day" type="date" defaultValue={values?.day ?? defaultDay} required />
        </Field>
        <Field label={t('venue')}>
          <Input name="venue" defaultValue={values?.venue ?? ''} maxLength={200} />
        </Field>
        <Field label={t('callRoomPlace')}>
          <Input name="callRoomPlace" defaultValue={values?.callRoomPlace ?? ''} maxLength={200} />
        </Field>
        <Field label={t('callRoomTime')}>
          <Input name="callRoomTime" type="time" defaultValue={values?.callRoomTime ?? ''} />
        </Field>
        <Field label={t('startTime')}>
          <Input name="startTime" type="time" defaultValue={values?.startTime ?? ''} />
        </Field>
      </div>
      {/* 目標の大会。今日のアドバイスが、いちばん近い目標の大会の前2週間を調整期にする。
          「主目標／ふつうの大会」の切り替えを、押すと付く「目標」1つにした（中元さんの弟さんの要望、2026-10-18） */}
      <div className="flex">
        <input type="hidden" name="isTarget" value={String(isTarget)} />
        <button
          type="button"
          aria-pressed={isTarget}
          onClick={() => setIsTarget(!isTarget)}
          className={cn(
            'h-9 rounded-full px-3 text-sm font-semibold transition active:scale-press',
            isTarget ? 'bg-secondary text-primary' : 'bg-muted text-muted-foreground',
          )}
        >
          {t('target')}
        </button>
      </div>
      <Field label={t('entryUrl')}>
        <Input
          name="entryUrl"
          type="url"
          inputMode="url"
          defaultValue={initial ? (initial.entryUrl ?? '') : (draft?.entryUrl ?? defaultEntryUrl)}
          maxLength={URL_MAX_LENGTH}
        />
      </Field>
      <Field label={t('notes')}>
        <TextArea
          name="notes"
          defaultValue={values?.notes ?? ''}
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
