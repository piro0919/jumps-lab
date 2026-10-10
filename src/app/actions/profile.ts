'use server';

import { refresh } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { saveProfile, setCurrentEvent } from '@/lib/data';
import { isTimeZone, todayIn } from '@/lib/dates';
import { EVENTS, isJumpEvent } from '@/lib/events';
import { type ActionResult, optionalNumber } from '@/lib/form';
import { computesGrade, offsetFor } from '@/lib/grade';
import { GRADES } from '@/lib/profile-options';
import { requireViewer } from '@/lib/viewer';

const schema = z.object({
  name: z.string().trim().min(1, 'name').max(100),
  grade: z.preprocess((v) => (v === '' ? null : v), z.enum(GRADES).nullable()),
  birthdate: z.preprocess(
    (v) => (v === '' || v === undefined ? null : v),
    z.iso
      .date()
      .refine((d) => d >= '1900-01-01' && d <= new Date().toISOString().slice(0, 10))
      .nullable(),
  ),
  gender: z.preprocess(
    (v) => (v === '' ? null : v),
    z.enum(['male', 'female', 'other']).nullable(),
  ),
  heightCm: optionalNumber(50, 250),
  weightKg: optionalNumber(20, 300),
  events: z.array(z.enum(EVENTS)).min(1, 'events'),
  goalM: optionalNumber(0.01, 29.99),
  units: z.enum(['metric', 'imperial']),
  seasonStartMonth: z.coerce.number().int().min(1).max(12),
  timeZone: z.string().refine(isTimeZone).catch('UTC'),
});

/**
 * プロフィールを保存する。初回（ようこそ画面）と設定画面の両方から呼ぶ。
 * 初回はホームへ送る。設定画面からは画面をそのまま描き直す
 */
export async function saveProfileAction(
  _previous: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const viewer = await requireViewer();
  const parsed = schema.safeParse({
    ...Object.fromEntries(formData),
    events: formData.getAll('events'),
    goalM: formData.get('goalM') ?? '',
  });
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message;
    return { ok: false, error: message === 'name' || message === 'events' ? message : 'generic' };
  }

  // 学年を計算する人は、選んだ学年を計算とのずれに直して持つ（学年そのものは保存しない）。
  // ほかの人は選んだ学年をそのまま持つ
  const { grade: chosen, birthdate, timeZone } = parsed.data;
  const computes = computesGrade(birthdate, timeZone);
  const gradeOffset =
    computes && chosen
      ? Math.max(-10, Math.min(10, offsetFor(birthdate, chosen, todayIn(timeZone))))
      : 0;

  try {
    await saveProfile(viewer.userId, {
      ...parsed.data,
      grade: computes ? null : chosen,
      gradeOffset,
    });
  } catch (error) {
    console.error(error);
    return { ok: false, error: 'generic' };
  }

  if (formData.get('from') === 'welcome') redirect('/');
  refresh();
  return { ok: true };
}

export async function setCurrentEventAction(event: string): Promise<void> {
  const viewer = await requireViewer();
  if (!isJumpEvent(event)) return;
  await setCurrentEvent(viewer.userId, event);
  refresh();
}
