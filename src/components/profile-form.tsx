'use client';

import { useTranslations } from 'next-intl';
import { ActionForm } from '@/components/action-form';
import { useActionState, useEffect, useRef, useState } from 'react';
import {
  saveProfileAction,
  saveProfileDetailsAction,
  saveRecordSettingsAction,
} from '@/app/actions/profile';
import { HeightInput, MarkInput, WeightInput } from '@/components/measure-inputs';
import {
  Card,
  CardTitle,
  ErrorText,
  Field,
  FieldLabel,
  Input,
  Select,
} from '@/components/layout-ui';
import { Button } from '@/components/ui/button';
import type { Profile } from '@/lib/data';
import { EVENTS } from '@/lib/events';
import type { ActionResult } from '@/lib/form';
import { todayIn } from '@/lib/dates';
import { computesGrade, gradeFromNumber, gradeNumber } from '@/lib/grade';
import { GRADES } from '@/lib/profile-options';
import type { Units } from '@/lib/units';

/*
 * プロフィールの入力。本人のこと（名前・生年月日・学年・性別・身長・体重）と、
 * 記録のつけ方（種目・単位・シーズンの始まり）の2つに分ける。
 * 設定の画面ではカードも保存も別々（本人、2026-10-11「別々のほうがわかりやすい」）。
 * 初回（ようこそ画面）は1枚のカードにまとめて、一度に保存する
 */

const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);

/** 時間帯はブラウザが知っている。サーバーの描画と食い違わないよう、描いた後に欄へ入れる */
function TimeZoneInput({ initial }: { initial: string }) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.value = Intl.DateTimeFormat().resolvedOptions().timeZone;
  }, []);
  return <input ref={ref} type="hidden" name="timeZone" defaultValue={initial} />;
}

/** 本人のこと。身長と体重は units の単位で入れる */
function ProfileFields({
  initial,
  initialGrade,
  defaultName,
  units,
}: {
  initial: Profile | null;
  /** いまの学年（計算する人は計算した値） */
  initialGrade: string | null;
  defaultName: string;
  units: Units;
}) {
  const t = useTranslations('profile');
  const tGrades = useTranslations('grades');
  const tGenders = useTranslations('genders');

  // 学年。生年月日を入れたら、日本の時間帯の人には計算した学年を入れる（直してよい）。
  // 保存する側でも同じ線で決める（src/app/actions/profile.ts）
  const [grade, setGrade] = useState<string>(initialGrade ?? '');
  const fillGrade = (birthdate: string) => {
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(birthdate) || !computesGrade(birthdate, timeZone)) return;
    setGrade(gradeFromNumber(gradeNumber(birthdate, todayIn(timeZone))) ?? '');
  };

  return (
    // 2つずつ横に並べる：名前・性別／生年月日・学年／身長・体重（本人、2026-10-11。
    // 性別だけ1行を取る形は好きじゃないと言われた）
    <div className="grid grid-cols-2 gap-4">
      <Field label={t('name')} required={t('required')}>
        <Input name="name" defaultValue={defaultName} required maxLength={100} />
      </Field>
      <Field label={t('gender')}>
        <Select name="gender" defaultValue={initial?.gender ?? ''}>
          <option value="">{t('notSet')}</option>
          <option value="male">{tGenders('male')}</option>
          <option value="female">{tGenders('female')}</option>
          <option value="other">{tGenders('other')}</option>
        </Select>
      </Field>
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
      {/* 単位を切り替えたら、保存済みの値からやり直す（換算の途中の値を混ぜない） */}
      <Field label={t('height')}>
        <HeightInput key={units} name="heightCm" units={units} defaultCm={initial?.heightCm} />
      </Field>
      <Field label={t('weight')}>
        <WeightInput key={units} name="weightKg" units={units} defaultKg={initial?.weightKg} />
      </Field>
    </div>
  );
}

/** 記録のつけ方。種目と単位は呼ぶ側が持つ（初回は単位で身長・体重の欄も変わるため） */
function RecordFields({
  initial,
  locale,
  events,
  onToggle,
  units,
  onUnits,
  showGoal,
}: {
  initial: Profile | null;
  locale: string;
  events: string[];
  onToggle: (event: string) => void;
  units: Units;
  onUnits: (units: Units) => void;
  /** 初回だけ、先頭の種目の今季目標を入れる */
  showGoal: boolean;
}) {
  const t = useTranslations('profile');
  const tEvents = useTranslations('events');
  const tUnits = useTranslations('units');
  const monthName = (month: number) =>
    new Intl.DateTimeFormat(locale, { month: 'long' }).format(new Date(2026, month - 1, 1));

  return (
    <div className="grid grid-cols-2 gap-4">
      {events.map((event) => (
        <input key={event} type="hidden" name="events" value={event} />
      ))}
      <div className="col-span-2 flex flex-col gap-1.5">
        <FieldLabel label={t('events')} required={t('required')} />
        <div className="flex flex-wrap gap-2">
          {EVENTS.map((event) => {
            const on = events.includes(event);
            return (
              <button
                key={event}
                type="button"
                aria-pressed={on}
                onClick={() => onToggle(event)}
                className={`h-9 rounded-full px-3.5 text-sm font-semibold transition active:scale-[0.98] ${
                  on ? 'bg-secondary text-primary' : 'bg-muted text-muted-foreground'
                }`}
              >
                {tEvents(event)}
              </button>
            );
          })}
        </div>
      </div>
      <Field label={t('units')}>
        <Select name="units" value={units} onChange={(e) => onUnits(e.target.value as Units)}>
          <option value="metric">{tUnits('metric')}</option>
          <option value="imperial">{tUnits('imperial')}</option>
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
      {showGoal && (
        <div className="col-span-2">
          <Field label={t('goal')}>
            <MarkInput key={units} name="goalM" units={units} />
          </Field>
        </div>
      )}
    </div>
  );
}

/** カードの右下の保存（記録の日の画面と同じ）。結果を左に出す */
function SaveRow({
  state,
  pending,
  disabled,
  label,
}: {
  state: ActionResult;
  pending: boolean;
  disabled?: boolean;
  label: string;
}) {
  const t = useTranslations('profile');
  const tErrors = useTranslations('errors');
  return (
    <div className="flex items-center justify-end gap-3">
      <ErrorText>{state?.ok === false ? tErrors(state.error as 'generic') : null}</ErrorText>
      {state?.ok && !pending && <span className="text-sm text-good">{t('saved')}</span>}
      <Button type="submit" disabled={pending || disabled}>
        {label}
      </Button>
    </div>
  );
}

function useEvents(initial: Profile | null) {
  const [events, setEvents] = useState<string[]>(initial?.events ?? []);
  const toggle = (event: string) =>
    setEvents((current) =>
      current.includes(event) ? current.filter((e) => e !== event) : [...current, event],
    );
  return [events, toggle] as const;
}

/** 初回（ようこそ画面）。1枚のカードに2つを見出しで分けて並べ、一度に保存してホームへ */
export function ProfileForm({ defaultName, locale }: { defaultName: string; locale: string }) {
  const t = useTranslations('profile');
  const [state, action, pending] = useActionState(saveProfileAction, null);
  const [units, setUnits] = useState<Units>('metric');
  const [events, toggle] = useEvents(null);

  return (
    <ActionForm action={action}>
      <TimeZoneInput initial="UTC" />
      <Card className="flex flex-col gap-6">
        <div>
          <CardTitle>{t('sectionProfile')}</CardTitle>
          <ProfileFields
            initial={null}
            initialGrade={null}
            defaultName={defaultName}
            units={units}
          />
        </div>
        <div className="border-t border-border pt-6">
          <CardTitle>{t('sectionRecords')}</CardTitle>
          <RecordFields
            initial={null}
            locale={locale}
            events={events}
            onToggle={toggle}
            units={units}
            onUnits={setUnits}
            showGoal
          />
        </div>
        <SaveRow
          state={state}
          pending={pending}
          disabled={events.length === 0}
          label={t('start')}
        />
      </Card>
    </ActionForm>
  );
}

/** 設定の画面の「プロフィール」の区画。身長と体重は保存済みの単位で入れる */
export function ProfileSettingsForm({
  initial,
  initialGrade,
}: {
  initial: Profile;
  initialGrade: string | null;
}) {
  const t = useTranslations('profile');
  const [state, action, pending] = useActionState(saveProfileDetailsAction, null);

  return (
    <ActionForm action={action}>
      <TimeZoneInput initial={initial.timeZone} />
      <Card className="flex flex-col gap-5">
        <div>
          <CardTitle>{t('sectionProfile')}</CardTitle>
          <ProfileFields
            initial={initial}
            initialGrade={initialGrade}
            defaultName={initial.name}
            units={initial.units}
          />
        </div>
        <SaveRow state={state} pending={pending} label={t('save')} />
      </Card>
    </ActionForm>
  );
}

/** 設定の画面の「記録」の区画 */
export function RecordSettingsForm({ initial, locale }: { initial: Profile; locale: string }) {
  const t = useTranslations('profile');
  const [state, action, pending] = useActionState(saveRecordSettingsAction, null);
  const [units, setUnits] = useState<Units>(initial.units);
  const [events, toggle] = useEvents(initial);

  return (
    <ActionForm action={action}>
      <TimeZoneInput initial={initial.timeZone} />
      <Card className="flex flex-col gap-5">
        <div>
          <CardTitle>{t('sectionRecords')}</CardTitle>
          <RecordFields
            initial={initial}
            locale={locale}
            events={events}
            onToggle={toggle}
            units={units}
            onUnits={setUnits}
            showGoal={false}
          />
        </div>
        <SaveRow state={state} pending={pending} disabled={events.length === 0} label={t('save')} />
      </Card>
    </ActionForm>
  );
}
