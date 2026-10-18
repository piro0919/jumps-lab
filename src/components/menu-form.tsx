'use client';

// 線（components/progress.tsx）を出すため、移るのは @bprogress の useRouter で
import { useRouter } from '@bprogress/next/app';
import { useFormatter, useTranslations } from 'next-intl';
import { useActionState, useState } from 'react';
import { createMenuAction } from '@/app/actions/menu';
import { safely } from '@/lib/safe-action';
import { ActionForm } from '@/components/action-form';
import { ConditionSection } from '@/components/day-log-form';
import type { WeatherAccess } from '@/lib/joint-use';
import type { Units } from '@/lib/units';
import { FormActions } from '@/components/form-actions';
import {
  ErrorText,
  Field,
  FieldLabel,
  Input,
  SEGMENT_GRID,
  segmentClass,
  TextArea,
} from '@/components/layout-ui';
import { cn } from '@/lib/cn';
import { INJURY_STATUSES, type InjuryStatus } from '@/lib/injury';
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
  injury,
  weatherAccess,
  units,
}: {
  meetDay: boolean;
  /** 今日のコンディションがまだ無い。閉じた「コンディションを入力」を一番上に出す（2026-10-18） */
  askCondition: boolean;
  /** 直近14日の痛み・違和感のメモ（src/lib/injury.ts の injuryToAsk）。あれば今の具合を4択で聞く */
  injury: { day: string; injury: string } | null;
  /** コンディションの天気の欄の扱い（src/lib/joint-use.ts の weatherAccess） */
  weatherAccess: WeatherAccess;
  units: Units;
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
      {askCondition && <ConditionSection weatherAccess={weatherAccess} units={units} />}
      {injury && <InjuryStatusField injury={injury} />}
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

/**
 * 前に書いた痛み・違和感の今の具合（中元さんの弟さんの要望、2026-10-18）。答えなくてもよいので、選んだものを
 * もう一度押すと外れる。完全に治った以外は今日のアドバイスを「痛む箇所を守る」にし、AI にも送る
 */
function InjuryStatusField({ injury }: { injury: { day: string; injury: string } }) {
  const t = useTranslations('menu');
  const tToday = useTranslations('today');
  const format = useFormatter();
  const [status, setStatus] = useState<InjuryStatus | null>(null);
  const day = format.dateTime(new Date(`${injury.day}T00:00:00Z`), {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
  return (
    <div className="flex flex-col gap-1.5">
      <input type="hidden" name="injuryStatus" value={status ?? ''} />
      <FieldLabel label={t('injuryStatus')} />
      <p className="text-xs break-words text-muted-foreground">
        {t('injuryNote', { day, note: injury.injury })}
      </p>
      <div className={cn(SEGMENT_GRID, 'grid-cols-2')}>
        {INJURY_STATUSES.map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={status === option}
            onClick={() => setStatus(status === option ? null : option)}
            className={segmentClass(status === option)}
          >
            {tToday(`injuryStatus.${option}`)}
          </button>
        ))}
      </div>
    </div>
  );
}
