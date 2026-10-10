'use server';

import { refresh } from 'next/cache';
import { z } from 'zod';
import { addAttempt, deleteAttempt, getProfile, saveDayLog } from '@/lib/data';
import { hasWind } from '@/lib/events';
import { type ActionResult, optionalNumber, optionalText } from '@/lib/form';
import { requireViewer } from '@/lib/viewer';

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

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
  kind: z.enum(['practice', 'competition']),
  markM: z.coerce.number({ message: 'mark' }).min(0.01, 'mark').max(29.99, 'mark'),
  windMs: optionalNumber(-20, 20),
  note: optionalText(500),
});

/** 記録を1本足す。種目は本人がいま見ているもの。風は走幅跳と三段跳だけ残す */
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
  if (!profile) return { ok: false, error: 'generic' };

  const event = profile.currentEvent;
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
