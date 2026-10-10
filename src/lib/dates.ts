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

/** 時間帯の名前が使えるか。ブラウザから受け取った値を保存する前に確かめる */
export function isTimeZone(value: string): boolean {
  try {
    new Intl.DateTimeFormat('en', { timeZone: value });
    return true;
  } catch {
    return false;
  }
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
