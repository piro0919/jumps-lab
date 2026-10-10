/**
 * 日付。日付は 'YYYY-MM-DD' の文字列で扱い、時刻と時間帯を混ぜない。
 * 「今日」は本人の時間帯で数える（Vercel の時計は UTC なので、サーバーの日付をそのまま使わない）
 */

/** その時間帯での今日。呼ぶたびに数える（モジュールの読み込み時に固定しない） */
export function todayIn(timeZone: string, now: Date = new Date()): string {
  // en-CA は YYYY-MM-DD の並びで出す
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

/** 実在する日付の 'YYYY-MM-DD' か（2026-02-30 や 2026-13-01 は外す） */
export function isDay(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

/** 'YYYY-MM' の形で、月が 01〜12 か */
export function isMonth(value: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

/** 時間帯の名前が使えるか。ブラウザから受け取った値を保存する前に確かめる */
export function isTimeZone(value: string): boolean {
  try {
    new Intl.DateTimeFormat('en', { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

/** day から n 日ずらした日（YYYY-MM-DD）。n が負なら前の日 */
export function addDays(day: string, n: number): string {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + n);
  return date.toISOString().slice(0, 10);
}

/** 2つの日付の差（日数）。b が a より後なら正 */
export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
}

/**
 * その日が属するシーズンの始まりの年。シーズンは startMonth の1日から1年。
 * 例: 4月始まりなら 2026-03-31 は 2025 年のシーズン、2026-04-01 は 2026 年のシーズン
 */
export function seasonOf(day: string, startMonth: number): number {
  const year = Number(day.slice(0, 4));
  const month = Number(day.slice(5, 7));
  return month >= startMonth ? year : year - 1;
}

/** シーズンの初日（その日を含む） */
export function seasonStart(season: number, startMonth: number): string {
  return `${season}-${String(startMonth).padStart(2, '0')}-01`;
}

/**
 * アドレスの日付（/log/today や /log/2026-10-11）を、記録できる日に直す。
 * today は本人の時間帯の今日。実在しない日と先の日は null（呼ぶ側が今日へ送る）
 */
export function resolveLogDay(requested: string, today: string): string | null {
  if (requested === 'today') return today;
  return isDay(requested) && requested <= today ? requested : null;
}
