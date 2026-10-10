import { type JumpEvent, isWindAided } from './events';

type AttemptLike = {
  day: string;
  event: JumpEvent;
  kind: 'practice' | 'competition';
  markM: number;
  windMs: number | null;
};

export type CompetitionResult = { event: JumpEvent; bestM: number; windAided: boolean };

/**
 * 大会の日の結果。大会と記録は日付で結び付ける（大会の日に「大会」として入れた記録）。
 * 種目ごとにいちばん良い1本。公認になる記録があればその中の最高を、無ければ追い風参考の最高を出す
 */
export function competitionResults(attempts: AttemptLike[]): Map<string, CompetitionResult[]> {
  const byDay = new Map<string, CompetitionResult[]>();
  for (const attempt of attempts) {
    if (attempt.kind !== 'competition') continue;
    const results = byDay.get(attempt.day) ?? [];
    byDay.set(attempt.day, results);
    const candidate = {
      event: attempt.event,
      bestM: attempt.markM,
      windAided: isWindAided(attempt.windMs),
    };
    const index = results.findIndex((r) => r.event === attempt.event);
    const current = results[index];
    if (!current) {
      results.push(candidate);
    } else if (
      // 公認の記録は追い風参考より優先し、同じ扱いどうしなら長い方
      (current.windAided && !candidate.windAided) ||
      (current.windAided === candidate.windAided && candidate.bestM > current.bestM)
    ) {
      results[index] = candidate;
    }
  }
  return byDay;
}
