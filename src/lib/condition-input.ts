import { z } from 'zod';
import { optionalNumber, optionalText } from '@/lib/form';
import { NOTE_MAX_LENGTH, SCALE_MAX, SLEEP_MAX_HOURS } from '@/lib/limits';

/** その日のコンディション（体調・疲労度・睡眠・ケガ）の欄。練習メモは含まない */
export const conditionSchema = z.object({
  condition: optionalNumber(1, SCALE_MAX),
  fatigue: optionalNumber(1, SCALE_MAX),
  sleepHours: optionalNumber(0, SLEEP_MAX_HOURS),
  injury: optionalText(NOTE_MAX_LENGTH),
});

export type ConditionInput = z.infer<typeof conditionSchema>;

/**
 * 試技やメニューの送信に添えられたその日のコンディション（2026-10-18）。
 * 欄を閉じたまま送ると欄は送られないので null（入れなかった）。範囲の外は false
 */
export function conditionFrom(raw: Record<string, unknown>): ConditionInput | null | false {
  if (!('condition' in raw)) return null;
  const parsed = conditionSchema.safeParse(raw);
  return parsed.success ? parsed.data : false;
}
