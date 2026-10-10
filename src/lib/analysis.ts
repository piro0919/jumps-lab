import type { MarkRow } from './bests';
import { ISO_MONTH_END } from './dates';
import { TENTH_MM_PER_M } from './units';

/** 分析の画面で並べる、直近の本数 */
const RECENT_COUNT = 10;

export type Analysis = {
  total: number;
  averageM: number | null;
  /** 新しい月から */
  monthlyBest: { month: string; bestM: number }[];
  /** 直近10本。古い順 */
  recent: MarkRow[];
};

/**
 * 分析の画面の数字。練習と試合を分けずに数える（プロトタイプと同じ）。
 * rows は古い順で渡す
 */
export function analyze(rows: MarkRow[]): Analysis {
  const byMonth = new Map<string, number>();
  for (const row of rows) {
    const month = row.day.slice(0, ISO_MONTH_END);
    byMonth.set(month, Math.max(byMonth.get(month) ?? 0, row.markM));
  }

  return {
    total: rows.length,
    averageM:
      rows.length === 0
        ? null
        : // 記録と同じ 0.1mm で丸める（センチで丸めるとフィート・インチの表示がずれる）
          Math.round((rows.reduce((sum, r) => sum + r.markM, 0) / rows.length) * TENTH_MM_PER_M) /
          TENTH_MM_PER_M,
    monthlyBest: [...byMonth]
      .map(([month, bestM]) => ({ month, bestM }))
      .sort((a, b) => b.month.localeCompare(a.month)),
    recent: rows.slice(-RECENT_COUNT),
  };
}
