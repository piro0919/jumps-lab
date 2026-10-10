'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';
import { getProfile, saveTargets } from '@/lib/data';
import { seasonOf, todayIn } from '@/lib/dates';
import { EVENTS } from '@/lib/events';
import { type ActionResult, optionalNumber } from '@/lib/form';
import { requireViewer } from '@/lib/viewer';

// 空で送った欄は消す
const mark = optionalNumber(0.01, 29.99);

const schema = z.object({
  event: z.enum(EVENTS),
  seasonGoalM: mark,
  manualPbM: mark,
  manualSbM: mark,
  manualPracticeBestM: mark,
});

/**
 * 1種目の今季目標と、手で入れる自己ベスト・今季ベスト・練習ベストをまとめて書き換え、ホームへ戻る。
 * 種目は本人の選んだ種目だけ
 */
export async function saveTargetsAction(
  _previous: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const viewer = await requireViewer();
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: 'generic' };

  const profile = await getProfile(viewer.userId);
  if (!profile || !profile.events.includes(parsed.data.event))
    return { ok: false, error: 'generic' };

  const { event, ...values } = parsed.data;
  const season = seasonOf(todayIn(profile.timeZone), profile.seasonStartMonth);
  try {
    await saveTargets(viewer.userId, event, values, season);
  } catch (error) {
    console.error(error);
    return { ok: false, error: 'generic' };
  }
  redirect('/');
}
