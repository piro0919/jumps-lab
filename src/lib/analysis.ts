import type { MarkRow } from './bests';

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
    const month = row.day.slice(0, 7);
    byMonth.set(month, Math.max(byMonth.get(month) ?? 0, row.markM));
  }

  return {
    total: rows.length,
    averageM:
      rows.length === 0
        ? null
        : // 記録と同じ 0.1mm で丸める（センチで丸めるとフィート・インチの表示がずれる）
          Math.round((rows.reduce((sum, r) => sum + r.markM, 0) / rows.length) * 10000) / 10000,
    monthlyBest: [...byMonth]
      .map(([month, bestM]) => ({ month, bestM }))
      .sort((a, b) => b.month.localeCompare(a.month)),
    recent: rows.slice(-10),
  };
}
