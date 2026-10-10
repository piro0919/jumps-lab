'use server';

import { refresh } from 'next/cache';
import { z } from 'zod';
import { getProfile, saveTargetField } from '@/lib/data';
import { seasonOf, todayIn } from '@/lib/dates';
import { EVENTS } from '@/lib/events';
import { type ActionResult, optionalNumber } from '@/lib/form';
import { requireViewer } from '@/lib/viewer';

const schema = z.object({
  event: z.enum(EVENTS),
  field: z.enum(['seasonGoalM', 'manualPbM', 'manualSbM', 'manualPracticeBestM']),
  // 空で送ると消す
  markM: optionalNumber(0.01, 29.99),
});

/** 今季目標と、手で入れるベストのうち1つを書き換える。種目はカードのもの（本人の選んだ種目だけ） */
export async function saveTargetAction(
  _previous: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const viewer = await requireViewer();
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: 'generic' };

  const profile = await getProfile(viewer.userId);
  if (!profile || !profile.events.includes(parsed.data.event))
    return { ok: false, error: 'generic' };

  const season = seasonOf(todayIn(profile.timeZone), profile.seasonStartMonth);
  try {
    await saveTargetField(
      viewer.userId,
      parsed.data.event,
      parsed.data.field,
      parsed.data.markM,
      season,
    );
  } catch (error) {
    console.error(error);
    return { ok: false, error: 'generic' };
  }
  refresh();
  return { ok: true };
}
