import { addDays } from './dates';

/** ケガの経過（中元さんの弟さんの要望、2026-10-18）。完全に治った・軽くなった・まだ痛む・悪化した */
export const INJURY_STATUSES = ['healed', 'better', 'same', 'worse'] as const;
export type InjuryStatus = (typeof INJURY_STATUSES)[number];

/** 痛み・違和感のメモを振り返る日数（今日を除く） */
export const INJURY_LOOKBACK_DAYS = 14;

/** 治った以外は、まだ痛みが残っている（今日のアドバイスを「痛む箇所を守る」にする） */
export const stillHurts = (status: InjuryStatus | null | undefined) =>
  status !== null && status !== undefined && status !== 'healed';

/**
 * メニューを作る画面で、ケガの経過を聞くか。聞くなら、振り返る元のメモ（いちばん新しいもの）を返す。
 * 聞くのは、今日を除く直近14日に痛み・違和感のメモがあり、今日はまだメモが無いとき。
 * そのメモの日より後に「完全に治った」と答えていれば、もう聞かない
 */
export function injuryToAsk(
  logs: { day: string; injury: string | null; injuryStatus: InjuryStatus | null }[],
  today: string,
): { day: string; injury: string } | null {
  const from = addDays(today, -INJURY_LOOKBACK_DAYS);
  if (logs.some((log) => log.day === today && log.injury?.trim())) return null;
  const latest = logs
    .filter((log) => log.day >= from && log.day < today && log.injury?.trim())
    .toSorted((a, b) => b.day.localeCompare(a.day))[0];
  if (!latest?.injury) return null;
  const healed = logs.some((log) => log.day > latest.day && log.injuryStatus === 'healed');
  return healed ? null : { day: latest.day, injury: latest.injury.trim() };
}
