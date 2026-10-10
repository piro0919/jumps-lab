'use server';

import { refresh } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { repairTimeZone, saveProfile, saveProfileDetails, saveRecordSettings } from '@/lib/data';
import { isTimeZone, todayIn } from '@/lib/dates';
import { EVENTS } from '@/lib/events';
import { type ActionResult, optionalNumber } from '@/lib/form';
import { computesGrade, offsetFor, usesGrade } from '@/lib/grade';
import { GRADES } from '@/lib/profile-options';
import { requireViewer } from '@/lib/viewer';

const timeZone = z.string().refine(isTimeZone).catch('UTC');

/** 本人のこと（設定の画面の「プロフィール」の区画） */
const detailsSchema = z.object({
  name: z.string().trim().min(1, 'name').max(100),
  // 日本の外の人には学年の欄が無く、送られてこない（空と同じに扱う）
  grade: z.preprocess((v) => (v === '' || v === undefined ? null : v), z.enum(GRADES).nullable()),
  birthdate: z.preprocess(
    (v) => (v === '' || v === undefined ? null : v),
    // 上限（本人の時間帯の今日まで）は時間帯と合わせて gradeFields の前に確かめる
    z.iso
      .date()
      .refine((d) => d >= '1900-01-01')
      .nullable(),
  ),
  gender: z.preprocess(
    (v) => (v === '' ? null : v),
    z.enum(['male', 'female', 'other']).nullable(),
  ),
  heightCm: optionalNumber(50, 250),
  weightKg: optionalNumber(20, 300),
  timeZone,
});

/** 記録のつけ方（設定の画面の「記録」の区画） */
const recordsSchema = z.object({
  events: z.array(z.enum(EVENTS)).min(1, 'events'),
  units: z.enum(['metric', 'imperial']),
  seasonStartMonth: z.coerce.number().int().min(1).max(12),
  weekStart: z.coerce
    .number()
    .pipe(z.union([z.literal(0), z.literal(1)]))
    .catch(0),
  timeZone,
});

/** 初回はどちらも一度に入れ、先頭の種目の今季目標も入れられる */
const fullSchema = detailsSchema.extend(recordsSchema.shape).extend({
  goalM: optionalNumber(0.01, 29.99),
});

/** 入力の誤りを、画面に出す文言の鍵へ */
function errorOf(error: z.ZodError): ActionResult {
  const message = error.issues[0]?.message;
  return { ok: false, error: message === 'name' || message === 'events' ? message : 'generic' };
}

/**
 * 学年を計算する人は、選んだ学年を計算とのずれに直して持つ（学年そのものは保存しない）。
 * 日本の時間帯で計算しない人（生年月日が無い人）は選んだ学年をそのまま持ち、日本の外の人は学年を持たない
 */
function gradeFields(details: z.infer<typeof detailsSchema>) {
  const { grade: chosen, birthdate, timeZone } = details;
  const computes = computesGrade(birthdate, timeZone);
  return {
    grade: computes || !usesGrade(timeZone) ? null : chosen,
    gradeOffset:
      computes && chosen
        ? Math.max(-10, Math.min(10, offsetFor(birthdate, chosen, todayIn(timeZone))))
        : 0,
  };
}

/** 生年月日が本人の時間帯の今日より後なら誤り（サーバーの UTC の今日では、日本の朝に今日を入れると弾かれる） */
function futureBirthdate(details: z.infer<typeof detailsSchema>): boolean {
  return details.birthdate !== null && details.birthdate > todayIn(details.timeZone);
}

/** 保存して、失敗は文言の鍵で返す */
async function run(save: () => Promise<void>): Promise<ActionResult> {
  try {
    await save();
  } catch (error) {
    console.error(error);
    return { ok: false, error: 'generic' };
  }
  return { ok: true };
}

/** 初回（ようこそ画面）。プロフィールと記録のつけ方をまとめて入れ、ホームへ送る */
export async function saveProfileAction(
  _previous: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const viewer = await requireViewer();
  const parsed = fullSchema.safeParse({
    ...Object.fromEntries(formData),
    events: formData.getAll('events'),
    goalM: formData.get('goalM') ?? '',
  });
  if (!parsed.success) return errorOf(parsed.error);
  if (futureBirthdate(parsed.data)) return { ok: false, error: 'generic' };

  const result = await run(() =>
    saveProfile(viewer.userId, { ...parsed.data, ...gradeFields(parsed.data) }),
  );
  if (!result?.ok) return result;
  redirect('/');
}

/** 設定の画面の「プロフィール」の区画だけを保存する */
export async function saveProfileDetailsAction(
  _previous: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const viewer = await requireViewer();
  const parsed = detailsSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return errorOf(parsed.error);
  if (futureBirthdate(parsed.data)) return { ok: false, error: 'generic' };

  const result = await run(() =>
    saveProfileDetails(viewer.userId, { ...parsed.data, ...gradeFields(parsed.data) }),
  );
  refresh();
  return result;
}

/** 設定の画面の「記録」の区画だけを保存する */
export async function saveRecordSettingsAction(
  _previous: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const viewer = await requireViewer();
  const parsed = recordsSchema.safeParse({
    ...Object.fromEntries(formData),
    events: formData.getAll('events'),
  });
  if (!parsed.success) return errorOf(parsed.error);

  const result = await run(() => saveRecordSettings(viewer.userId, parsed.data));
  refresh();
  return result;
}

/** 時間帯が UTC のまま保存された人を、ブラウザの時間帯に直す（components/time-zone-repair.tsx） */
export async function repairTimeZoneAction(value: string): Promise<boolean> {
  const viewer = await requireViewer();
  if (value === 'UTC' || !isTimeZone(value)) return false;
  const repaired = await repairTimeZone(viewer.userId, value);
  if (repaired) refresh();
  return repaired;
}
