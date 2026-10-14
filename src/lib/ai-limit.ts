import 'server-only';
import { type AiCallKind, claimAiCall } from '@/lib/data';
import { AI_CALL_LIMITS } from '@/lib/menu';

/** 上限に収まっていれば、AI を1回呼ぶ記録を入れて true（数えると記録を同時に送られても上限を超えない） */
export async function claimAiCallWithinLimit(
  userId: string,
  today: string,
  kind: AiCallKind,
  model: string,
): Promise<boolean> {
  return claimAiCall(userId, today, kind, model, AI_CALL_LIMITS[kind]);
}
