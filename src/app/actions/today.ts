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
import { attemptDetailsSchema, detailsError, keepDetailsFor } from '@/lib/attempt-details';
import { EVENTS, hasWind } from '@/lib/events';
import { checkSeries, hasHeightSeries, heightSeriesSchema } from '@/lib/height-series';
import { type ActionResult, optionalNumber, optionalText } from '@/lib/form';
import {
  LONG_NOTE_MAX_LENGTH,
  MARK_MAX_M,
  MARK_MIN_M,
  NOTE_MAX_LENGTH,
  SCALE_MAX,
  WIND_LIMIT_MS,
} from '@/lib/limits';
import { requireViewer } from '@/lib/viewer';

// 実在する日付だけ。先の日は画面で開けないので、本人の時間帯の今日と比べて弾く（openDay）
const day = z.string().refine(isDay);

/** 本人の時間帯で今日までの日か。画面と同じく先の日には書かせない */
function openDay(date: string, timeZone: string): boolean {
  return date <= todayIn(timeZone);
}

const dayLogSchema = z.object({
  day,
  condition: optionalNumber(1, SCALE_MAX),
  fatigue: optionalNumber(1, SCALE_MAX),
  sleepHours: optionalNumber(0, 24),
  injury: optionalText(NOTE_MAX_LENGTH),
  note: optionalText(LONG_NOTE_MAX_LENGTH),
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
  windMs: optionalNumber(-WIND_LIMIT_MS, WIND_LIMIT_MS),
  note: optionalText(NOTE_MAX_LENGTH),
});

// 記録は種目を読んでから（高さごとの結果があれば、送られてきた値ではなく越えた高さ）
const markSchema = z.coerce.number().min(MARK_MIN_M).max(MARK_MAX_M);

/**
 * 試技の保存の結果。高さごとの結果を弾いたときは、どの高さか（送られてきた行の位置。
 * 何も越えていない noClear は高さによらないので null）も返す。画面はその高さの名前で言う
 */
export type SaveAttemptResult =
  { ok: true } | { ok: false; error: string; row?: number | null } | null;

/**
 * 試技を1本足すか書き換える。種目は本人の選んだ種目だけ（書き換えは元の種目のままでもよい）。風は走幅跳と三段跳だけ残す。
 * 跳躍の細かい記録（src/lib/attempt-details.ts）は、種目に合う欄だけ残す。
 * 走高跳・棒高跳の高さごとの結果（src/lib/height-series.ts）があれば、規則どおりかを確かめ、記録は送られてきた値ではなく
 * いちばん高く越えた高さにする。何も越えていなければ保存しない（記録の列は空にできず、PB・平均が数える）
 */
export async function saveAttemptAction(
  _previous: SaveAttemptResult,
  formData: FormData,
): Promise<SaveAttemptResult> {
  const viewer = await requireViewer();
  const raw = Object.fromEntries(formData);
  const parsed = attemptSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: 'generic' };
  // 高さごとの結果は走高跳・棒高跳だけ。ほかの種目（種目を変えて直した試技も）では捨てる
  const series = heightSeriesSchema.safeParse(
    hasHeightSeries(parsed.data.event) ? raw.heightSeries : null,
  );
  if (!series.success) return { ok: false, error: 'generic' };
  let seriesMark: number | null = null;
  if (series.data) {
    const checked = checkSeries(series.data);
    if (!checked.ok) {
      const row = checked.error === 'noClear' ? null : checked.index;
      return { ok: false, error: `series.${checked.error}`, row };
    }
    seriesMark = checked.summary.bestM;
  }
  const mark = markSchema.safeParse(seriesMark ?? (raw.markM === '' ? undefined : raw.markM));
  if (!mark.success) return { ok: false, error: 'mark' };
  // 細かい記録は種目に合わない欄も含めて読み、範囲を確かめてから種目に合う欄だけ残す（keepDetailsFor）
  const details = attemptDetailsSchema.safeParse(raw);
  if (!details.success) {
    // どの欄が範囲の外かを返す（ブラウザを通らない要求と、ブラウザの検査をすり抜けた値）
    return { ok: false, error: detailsError(details.error) };
  }
  const profile = await getProfile(viewer.userId);
  const { id, ...input } = parsed.data;
  const event = input.event;
  // 書き換えるときは、種目から外した種目の試技でも、その種目のままなら直せる
  const existing = id ? await getAttempt(viewer.userId, id) : null;
  if (id && !existing) return { ok: false, error: 'generic' };
  const allowed = profile?.events.includes(event) || existing?.event === event;
  // 先の日を弾くのは足すときだけ。書き換えは日を変えない（updateAttempt）ので、時間帯を変えて
  // 元の日が「明日」になった試技も直せる
  if (!profile || !allowed || (!existing && !openDay(input.day, profile.timeZone))) {
    return { ok: false, error: 'generic' };
  }
  const values = {
    ...input,
    markM: mark.data,
    event,
    windMs: hasWind(event) ? input.windMs : null,
    details: keepDetailsFor(event, details.data),
    heightSeries: series.data,
  };
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
