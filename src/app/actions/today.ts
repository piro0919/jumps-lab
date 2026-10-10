'use server';

import { refresh } from 'next/cache';
import { z } from 'zod';
import {
  addAttempt,
  deleteAttempt,
  getAttempt,
  getProfile,
  saveDayLog,
  updateAttempt,
} from '@/lib/data';
import { isDay, todayIn } from '@/lib/dates';
import { EVENTS, hasWind } from '@/lib/events';
import { type ActionResult, optionalNumber, optionalText } from '@/lib/form';
import { requireViewer } from '@/lib/viewer';

// 実在する日付だけ。先の日は画面で開けないので、本人の時間帯の今日と比べて弾く（openDay）
const day = z.string().refine(isDay);

/** 本人の時間帯で今日までの日か。画面と同じく先の日には書かせない */
function openDay(date: string, timeZone: string): boolean {
  return date <= todayIn(timeZone);
}

const dayLogSchema = z.object({
  day,
  condition: optionalNumber(1, 10),
  fatigue: optionalNumber(1, 10),
  sleepHours: optionalNumber(0, 24),
  injury: optionalText(500),
  note: optionalText(2000),
});

/** その日の体調と練習メモ。欄ごとではなく、この塊を1つのボタンで保存する */
export async function saveDayLogAction(
  _previous: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const viewer = await requireViewer();
  const parsed = dayLogSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: 'generic' };
  const { day: date, ...log } = parsed.data;
  const profile = await getProfile(viewer.userId);
  if (!profile || !openDay(date, profile.timeZone)) return { ok: false, error: 'generic' };
  try {
    await saveDayLog(viewer.userId, date, log);
  } catch (error) {
    console.error(error);
    return { ok: false, error: 'generic' };
  }
  refresh();
  return { ok: true };
}

const attemptSchema = z.object({
  // あれば書き換え、無ければ足す
  id: z.preprocess((v) => (v === '' || v === undefined ? null : v), z.uuid().nullable()),
  day,
  event: z.enum(EVENTS),
  kind: z.enum(['practice', 'competition']),
  markM: z.coerce.number({ message: 'mark' }).min(0.01, 'mark').max(29.99, 'mark'),
  windMs: optionalNumber(-20, 20),
  note: optionalText(500),
});

/** 試技を1本足すか書き換える。種目は本人の選んだ種目だけ（書き換えは元の種目のままでもよい）。風は走幅跳と三段跳だけ残す */
export async function saveAttemptAction(
  _previous: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const viewer = await requireViewer();
  const raw = Object.fromEntries(formData);
  const parsed = attemptSchema.safeParse({
    ...raw,
    markM: raw.markM === '' ? undefined : raw.markM,
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message === 'mark' ? 'mark' : 'generic' };
  }
  const profile = await getProfile(viewer.userId);
  const { id, ...input } = parsed.data;
  const event = input.event;
  // 書き換えるときは、種目から外した種目の試技でも、その種目のままなら直せる
  const existing = id ? await getAttempt(viewer.userId, id) : null;
  if (id && !existing) return { ok: false, error: 'generic' };
  const allowed = profile?.events.includes(event) || existing?.event === event;
  if (!profile || !allowed || !openDay(input.day, profile.timeZone)) {
    return { ok: false, error: 'generic' };
  }
  const values = { ...input, event, windMs: hasWind(event) ? input.windMs : null };
  try {
    if (id) await updateAttempt(viewer.userId, id, values);
    else await addAttempt(viewer.userId, values);
  } catch (error) {
    console.error(error);
    return { ok: false, error: 'generic' };
  }
  refresh();
  return { ok: true };
}

export async function deleteAttemptAction(id: string): Promise<void> {
  const viewer = await requireViewer();
  if (!z.uuid().safeParse(id).success) return;
  await deleteAttempt(viewer.userId, id);
  refresh();
}
