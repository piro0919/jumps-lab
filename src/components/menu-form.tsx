'use client';

// 線（components/progress.tsx）を出すため、移るのは @bprogress の useRouter で
import { useRouter } from '@bprogress/next/app';
import { useTranslations } from 'next-intl';
import { useActionState } from 'react';
import { createMenuAction } from '@/app/actions/menu';
import { safely } from '@/lib/safe-action';
import { ActionForm } from '@/components/action-form';
import { ConditionSection } from '@/components/day-log-form';
import { FormActions } from '@/components/form-actions';
import { ErrorText, Field, Input, TextArea } from '@/components/layout-ui';
import { NOTE_MAX_LENGTH } from '@/lib/limits';
import { SESSION_MAX_MINUTES, SESSION_MIN_MINUTES } from '@/lib/menu';

/** 練習時間のはじめの値（分）。大会の当日はアップに使える時間 */
const DEFAULT_MINUTES = 90;
const DEFAULT_WARMUP_MINUTES = 60;

/**
 * 今日のメニューを作る前に、今日の練習の時間と場所・器具を聞く（/log/today/menu/new）。
 * 作り終えたらメニューの画面へ移る。AI の返事に十数秒かかるので、ボタンは作っている間押せない
 */
export function MenuForm({
  meetDay,
  askCondition,
}: {
  meetDay: boolean;
  /** 今日のコンディションがまだ無い。閉じた「コンディションを入力」を一番上に出す（2026-10-18） */
  askCondition: boolean;
}) {
  const router = useRouter();
  const t = useTranslations('menu');
  const tErrors = useTranslations('errors');
  const [state, action, pending] = useActionState(async (previous: unknown, formData: FormData) => {
    const result = await safely(() => createMenuAction(null, formData));
    if (result?.ok) router.push('/log/today/menu');
    return result;
  }, null);

  return (
    <ActionForm action={action} className="flex flex-col gap-4">
      {askCondition && <ConditionSection />}
      {/* 大会の当日は練習ではなく、招集時刻から逆算したアップの段取りを作る */}
      <Field label={t(meetDay ? 'warmupMinutes' : 'minutes')}>
        <Input
          name="minutes"
          type="number"
          inputMode="numeric"
          min={SESSION_MIN_MINUTES}
          max={SESSION_MAX_MINUTES}
          defaultValue={meetDay ? DEFAULT_WARMUP_MINUTES : DEFAULT_MINUTES}
          required
        />
      </Field>
      <Field label={t('note')}>
        <TextArea name="note" maxLength={NOTE_MAX_LENGTH} placeholder={t('notePlaceholder')} />
      </Field>
      <FormActions
        label={pending ? t('creating') : t('create')}
        pending={pending}
        message={
          <ErrorText>{state?.ok === false ? tErrors(state.error as 'generic') : null}</ErrorText>
        }
      />
    </ActionForm>
  );
}
