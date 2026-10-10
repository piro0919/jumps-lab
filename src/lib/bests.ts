import { seasonOf } from './dates';
import { isWindAided } from './events';

export type MarkRow = {
  day: string;
  kind: 'practice' | 'competition';
  markM: number;
  /** 風速（m/s）。走幅跳と三段跳だけ。無ければ null */
  windMs?: number | null;
};

export type ManualBests = {
  pbM: number | null;
  sbM: number | null;
  /** 手で入れた SB のシーズン。今のシーズンと違えば数えない */
  sbSeason: number | null;
  practiceBestM: number | null;
};

export type Bests = { pbM: number | null; sbM: number | null; practiceBestM: number | null };

function max(values: (number | null)[]): number | null {
  const present = values.filter((v): v is number => v !== null);
  return present.length > 0 ? Math.max(...present) : null;
}

/**
 * 1種目のベスト。記録から出した値と、手で入れた値の高い方。
 * PB と SB は試合の記録だけで数え、練習の記録は練習ベストに入れる（陸上の数え方）。
 * 追い風参考（追い風 2.0 m/s 超え）の試合の記録は PB と SB に数えない。
 * SB は today が属するシーズンの試合の記録だけ
 */
export function computeBests(
  rows: MarkRow[],
  manual: ManualBests,
  today: string,
  seasonStartMonth: number,
): Bests {
  const season = seasonOf(today, seasonStartMonth);
  const competition = rows.filter(
    (r) => r.kind === 'competition' && !isWindAided(r.windMs ?? null),
  );

  return {
    pbM: max([...competition.map((r) => r.markM), manual.pbM]),
    sbM: max([
      ...competition
        .filter((r) => seasonOf(r.day, seasonStartMonth) === season)
        .map((r) => r.markM),
      manual.sbSeason === season ? manual.sbM : null,
    ]),
    practiceBestM: max([
      ...rows.filter((r) => r.kind === 'practice').map((r) => r.markM),
      manual.practiceBestM,
    ]),
  };
}
