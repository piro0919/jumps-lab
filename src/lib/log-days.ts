import type { JumpEvent } from './events';

type AttemptLike = { day: string; event: JumpEvent; markM: number };
type DayLogLike = { day: string; condition: number | null; note: string | null };

export type LogDay = {
  day: string;
  /** 種目ごとの本数といちばん良い記録。種目の並びは記録した順 */
  events: { event: JumpEvent; count: number; bestM: number }[];
  condition: number | null;
  hasNote: boolean;
};

/**
 * 記録の一覧に並べる日。記録か体調・メモのどちらかがある日を、新しい日から並べる。
 * 記録はその日の古い順で渡す
 */
export function buildLogDays(attempts: AttemptLike[], logs: DayLogLike[]): LogDay[] {
  const days = new Map<string, LogDay>();
  const dayOf = (day: string) => {
    let entry = days.get(day);
    if (!entry) {
      entry = { day, events: [], condition: null, hasNote: false };
      days.set(day, entry);
    }
    return entry;
  };

  for (const attempt of attempts) {
    const entry = dayOf(attempt.day);
    const event = entry.events.find((e) => e.event === attempt.event);
    if (event) {
      event.count += 1;
      event.bestM = Math.max(event.bestM, attempt.markM);
    } else {
      entry.events.push({ event: attempt.event, count: 1, bestM: attempt.markM });
    }
  }
  for (const log of logs) {
    const entry = dayOf(log.day);
    entry.condition = log.condition;
    entry.hasNote = Boolean(log.note);
  }

  return [...days.values()].sort((a, b) => b.day.localeCompare(a.day));
}
