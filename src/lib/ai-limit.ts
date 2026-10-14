import 'server-only';
import { type AiCallKind, claimAiCall, countAiCalls } from '@/lib/data';
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

/** 上限に収まっていれば、AI を1回呼ぶ記録を入れて true（数えると記録を同時に送られても上限を超えない） */
export async function claimAiCallWithinLimit(
  userId: string,
  today: string,
  kind: AiCallKind,
  model: string,
): Promise<boolean> {
  return claimAiCall(userId, today, kind, model, AI_CALL_LIMITS[kind]);
}
