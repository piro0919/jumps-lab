'use server';

import { refresh } from 'next/cache';
import { z } from 'zod';
import { deleteCompetition, saveCompetition } from '@/lib/data';
import { type ActionResult, optionalText } from '@/lib/form';
import { requireViewer } from '@/lib/viewer';

const time = z.preprocess(
  (v) => (v === '' || v === undefined ? null : v),
  z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .nullable(),
);

const schema = z.object({
  id: z.preprocess((v) => (v === '' || v === undefined ? null : v), z.uuid().nullable()),
  name: z.string().trim().min(1, 'competitionName').max(200),
  day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'day'),
  venue: optionalText(200),
  callRoomPlace: optionalText(200),
  callRoomTime: time,
  startTime: time,
  notes: optionalText(2000),
});

/** 大会を足すか書き換える。id があれば書き換え（本人の大会だけ） */
export async function saveCompetitionAction(
  _previous: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const viewer = await requireViewer();
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message;
    return {
      ok: false,
      error: message === 'competitionName' || message === 'day' ? message : 'generic',
    };
  }
  try {
    await saveCompetition(viewer.userId, parsed.data);
  } catch (error) {
    console.error(error);
    return { ok: false, error: 'generic' };
  }
  refresh();
  return { ok: true };
}

export async function deleteCompetitionAction(id: string): Promise<void> {
  const viewer = await requireViewer();
  if (!z.uuid().safeParse(id).success) return;
  await deleteCompetition(viewer.userId, id);
  refresh();
}
