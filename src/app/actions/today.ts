'use server';

import { refresh } from 'next/cache';
import { z } from 'zod';
import { addAttempt, deleteAttempt, getProfile, saveDayLog } from '@/lib/data';
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
  day,
  event: z.enum(EVENTS),
  kind: z.enum(['practice', 'competition']),
  markM: z.coerce.number({ message: 'mark' }).min(0.01, 'mark').max(29.99, 'mark'),
  windMs: optionalNumber(-20, 20),
  note: optionalText(500),
});

/** 記録を1本足す。種目は足す窓で選んだもの（本人の選んだ種目だけ）。風は走幅跳と三段跳だけ残す */
export async function addAttemptAction(
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
  const event = parsed.data.event;
  if (!profile || !profile.events.includes(event) || !openDay(parsed.data.day, profile.timeZone)) {
    return { ok: false, error: 'generic' };
  }
  try {
    await addAttempt(viewer.userId, {
      ...parsed.data,
      event,
      windMs: hasWind(event) ? parsed.data.windMs : null,
    });
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
