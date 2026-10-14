import 'server-only';
import { type AiCallKind, countAiCalls } from '@/lib/data';
import { AI_CALL_LIMITS } from '@/lib/menu';

/** 今日・今月の AI の呼び出しが、その用途の上限（AI_CALL_LIMITS）に達しているか */
export async function overAiLimit(
  userId: string,
  today: string,
  kind: AiCallKind,
): Promise<boolean> {
  const used = await countAiCalls(userId, today, kind);
  const limit = AI_CALL_LIMITS[kind];
  return used.today >= limit.perDay || used.month >= limit.perMonth;
}
