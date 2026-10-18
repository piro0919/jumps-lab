import { z } from 'zod';
import { optionalNumber, optionalText } from '@/lib/form';
import {
  NOTE_MAX_LENGTH,
  SCALE_MAX,
  SLEEP_MAX_HOURS,
  WEATHER_CODE_MAX,
  WEATHER_TEMP_MAX_C,
  WEATHER_TEMP_MIN_C,
  WEATHER_WIND_DEG_MAX,
  WEATHER_WIND_MAX_MS,
} from '@/lib/limits';
import type { Weather } from '@/lib/weather';

/** 気温と風速を残す桁（DB の numeric(4, 1) と同じ 0.1） */
const TENTHS = 10;
const toTenths = (value: number) => Math.round(value * TENTHS) / TENTHS;

/**
 * その日の天気（2026-10-18）。画面は1つの隠し欄 weather に JSON で送り、空なら残さない（取っていない・外した）。
 * 範囲は DB の check と同じ（db/migrations/0030_day_weather.sql）
 */
const weatherObject = z.object({
  code: z.number().int().min(0).max(WEATHER_CODE_MAX),
  temperatureC: z.number().min(WEATHER_TEMP_MIN_C).max(WEATHER_TEMP_MAX_C).transform(toTenths),
  windMs: z.number().min(0).max(WEATHER_WIND_MAX_MS).transform(toTenths),
  windDeg: z.number().int().min(0).max(WEATHER_WIND_DEG_MAX),
  isDay: z.boolean(),
});

export const weatherSchema = z.preprocess((value): unknown => {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    // 読めない文字列は形の検査で弾く
    return value;
  }
}, weatherObject.nullable()) satisfies z.ZodType<Weather | null>;

/** その日のコンディション（体調・疲労度・睡眠・ケガ・天気）の欄。練習メモは含まない */
export const conditionSchema = z.object({
  condition: optionalNumber(1, SCALE_MAX),
  fatigue: optionalNumber(1, SCALE_MAX),
  sleepHours: optionalNumber(0, SLEEP_MAX_HOURS),
  injury: optionalText(NOTE_MAX_LENGTH),
  weather: weatherSchema,
});

export type ConditionInput = z.infer<typeof conditionSchema>;

/**
 * その日にコンディションを入れたか。ケガの経過だけの行（メニューを作る画面で経過だけ答えた日）は入れていない扱いにし、
 * 試技を足す画面とメニューを作る画面に「コンディションを入力」を出す（addDayConditionIfMissing もその行に書き足す）
 */
export function hasCondition(
  log: {
    condition: number | null;
    fatigue: number | null;
    sleepHours: number | null;
    injury: string | null;
  } | null,
): boolean {
  return (
    log !== null &&
    (log.condition !== null ||
      log.fatigue !== null ||
      log.sleepHours !== null ||
      log.injury !== null)
  );
}

/**
 * 試技やメニューの送信に添えられたその日のコンディション（2026-10-18）。
 * 欄を閉じたまま送ると欄は送られないので null（入れなかった）。範囲の外は false
 */
export function conditionFrom(raw: Record<string, unknown>): ConditionInput | null | false {
  if (!('condition' in raw)) return null;
  const parsed = conditionSchema.safeParse(raw);
  return parsed.success ? parsed.data : false;
}
