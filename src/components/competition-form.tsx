'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useActionState } from 'react';
import { saveCompetitionAction } from '@/app/actions/competitions';
import { ActionForm } from '@/components/action-form';
import { ErrorText, Field, Input, TextArea } from '@/components/layout-ui';
import { Button, buttonVariants } from '@/components/ui/button';
import type { Competition } from '@/lib/data';

/**
 * 大会の入力（/competitions/new と /competitions/[id]/edit の画面）。追加と編集で同じものを使う。
 * 保存したら大会の一覧へ戻る。入力は窓ではなく画面で行う（本人、2026-10-11「統一性がなくてわかりづらい」）
 */
export function CompetitionForm({
  initial,
  defaultDay,
}: {
  initial: Competition | null;
  defaultDay: string;
}) {
  const router = useRouter();
  const t = useTranslations('calendar');
  const tErrors = useTranslations('errors');
  const tProfile = useTranslations('profile');
  const [state, action, pending] = useActionState(async (previous: unknown, formData: FormData) => {
    const result = await saveCompetitionAction(null, formData);
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
      <Field label={t('notes')}>
        <TextArea name="notes" defaultValue={initial?.notes ?? ''} maxLength={2000} />
      </Field>
      <ErrorText>{state?.ok === false ? tErrors(state.error as 'generic') : null}</ErrorText>
      <div className="grid grid-cols-2 gap-3">
        <Link href="/competitions" className={buttonVariants({ variant: 'secondary' })}>
          {t('cancel')}
        </Link>
        <Button type="submit" disabled={pending}>
          {t('save')}
        </Button>
      </div>
    </ActionForm>
  );
}
