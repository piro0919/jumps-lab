'use client';

import { useTranslations } from 'next-intl';
import { ActionForm } from '@/components/action-form';
import { useActionState, useEffect, useRef, useState } from 'react';
import { saveProfileAction } from '@/app/actions/profile';
import { HeightInput, MarkInput, WeightInput } from '@/components/measure-inputs';
import { Card, ErrorText, Field, Input, PrimaryButton, Select } from '@/components/ui';
import type { Profile } from '@/lib/data';
import { EVENTS } from '@/lib/events';
import { todayIn } from '@/lib/dates';
import { computesGrade, gradeFromNumber, gradeNumber } from '@/lib/grade';
import { GRADES } from '@/lib/profile-options';
import type { Units } from '@/lib/units';

const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);

/**
 * プロフィールの入力。初回（from=welcome）と設定画面で同じものを使う。
 * 単位を先に選ばせ、切り替えたら長さと重さの欄を空からやり直す（換算の途中の値を混ぜない）
 */
export function ProfileForm({
  from,
  initial,
  initialGrade,
  defaultName,
  locale,
}: {
  from: 'welcome' | 'settings';
  initial: Profile | null;
  /** いまの学年（計算する人は計算した値） */
  initialGrade: string | null;
  defaultName: string;
  locale: string;
}) {
  const t = useTranslations('profile');
  const tEvents = useTranslations('events');
  const tGrades = useTranslations('grades');
  const tGenders = useTranslations('genders');
  const tUnits = useTranslations('units');
  const tErrors = useTranslations('errors');
  const [state, action, pending] = useActionState(saveProfileAction, null);
  const [units, setUnits] = useState<Units>(initial?.units ?? 'metric');
  const [events, setEvents] = useState<string[]>(initial?.events ?? []);
  // 時間帯はブラウザが知っている。サーバーの描画と食い違わないよう、描いた後に欄へ入れる
  const timeZoneRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (timeZoneRef.current) {
      timeZoneRef.current.value = Intl.DateTimeFormat().resolvedOptions().timeZone;
    }
  }, []);

  // 学年。生年月日を入れたら、日本の時間帯の人には計算した学年を入れる（直してよい）。
  // 保存する側でも同じ線で決める（src/app/actions/profile.ts）
  const [grade, setGrade] = useState<string>(initialGrade ?? '');
  const fillGrade = (birthdate: string) => {
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(birthdate) || !computesGrade(birthdate, timeZone)) return;
    setGrade(gradeFromNumber(gradeNumber(birthdate, todayIn(timeZone))) ?? '');
  };

  const monthName = (month: number) =>
    new Intl.DateTimeFormat(locale, { month: 'long' }).format(new Date(2026, month - 1, 1));

  const toggle = (event: string) =>
    setEvents((current) =>
      current.includes(event) ? current.filter((e) => e !== event) : [...current, event],
    );

  return (
    <ActionForm action={action} className="flex flex-col gap-4 pb-8">
      <input type="hidden" name="from" value={from} />
      <input
        ref={timeZoneRef}
        type="hidden"
        name="timeZone"
        defaultValue={initial?.timeZone ?? 'UTC'}
      />
      {events.map((event) => (
        <input key={event} type="hidden" name="events" value={event} />
      ))}

      <Card className="flex flex-col gap-4">
        <Field label={t('name')}>
          <Input name="name" defaultValue={defaultName} required maxLength={100} />
        </Field>
        <div className="flex flex-col gap-1.5">
          <span className="text-[13px] font-medium text-sub">{t('events')}</span>
          <div className="flex flex-wrap gap-2">
            {EVENTS.map((event) => {
              const on = events.includes(event);
              return (
                <button
                  key={event}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggle(event)}
                  className={`h-9 rounded-full px-3.5 text-sm font-semibold transition active:scale-[0.98] ${
                    on ? 'bg-accent-soft text-accent' : 'bg-field text-sub'
                  }`}
                >
                  {tEvents(event)}
                </button>
              );
            })}
          </div>
        </div>
        <Field label={t('units')}>
          <Select name="units" value={units} onChange={(e) => setUnits(e.target.value as Units)}>
            <option value="metric">{tUnits('metric')}</option>
            <option value="imperial">{tUnits('imperial')}</option>
          </Select>
        </Field>
        {from === 'welcome' && (
          <Field label={t('goal')}>
            <MarkInput key={units} name="goalM" units={units} />
          </Field>
        )}
      </Card>

      <Card className="grid grid-cols-2 gap-4">
        <Field label={t('birthdate')}>
          <Input
            name="birthdate"
            type="date"
            min="1900-01-01"
            defaultValue={initial?.birthdate ?? ''}
            onChange={(e) => fillGrade(e.target.value)}
          />
        </Field>
        <Field label={t('grade')}>
          <Select name="grade" value={grade} onChange={(e) => setGrade(e.target.value)}>
            <option value="">{t('notSet')}</option>
            {GRADES.map((value) => (
              <option key={value} value={value}>
                {tGrades(value)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t('gender')}>
          <Select name="gender" defaultValue={initial?.gender ?? ''}>
            <option value="">{t('notSet')}</option>
            <option value="male">{tGenders('male')}</option>
            <option value="female">{tGenders('female')}</option>
            <option value="other">{tGenders('other')}</option>
          </Select>
        </Field>
        <Field label={t('seasonStart')}>
          <Select name="seasonStartMonth" defaultValue={initial?.seasonStartMonth ?? 1}>
            {MONTHS.map((month) => (
              <option key={month} value={month}>
                {monthName(month)}
              </option>
            ))}
          </Select>
        </Field>
        <div className="col-span-2">
          <Field label={t('height')}>
            <HeightInput key={units} name="heightCm" units={units} defaultCm={initial?.heightCm} />
          </Field>
        </div>
        <div className="col-span-2">
          <Field label={t('weight')}>
            <WeightInput key={units} name="weightKg" units={units} defaultKg={initial?.weightKg} />
          </Field>
        </div>
      </Card>

      <div className="flex flex-col gap-2 px-4">
        <ErrorText>{state?.ok === false ? tErrors(state.error as 'generic') : null}</ErrorText>
        <PrimaryButton type="submit" disabled={pending || events.length === 0} className="w-full">
          {from === 'welcome' ? t('start') : t('save')}
        </PrimaryButton>
      </div>
    </ActionForm>
  );
}
