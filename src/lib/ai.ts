import 'server-only';
import { env } from '@/env';
import type { Profile } from '@/lib/data';

/**
 * AI を呼ぶところ。モデルへの問い合わせはここだけを通す（あとで Anthropic に替えたり、2社を比べたりできるように。
 * 2026-10-12 に本人と決めた）。いまは OpenAI の Responses API に、返す JSON の形（JSON Schema）を渡して呼ぶ
 */

/** 返事を待つ上限（ミリ秒）。メニュー1つで十数秒かかることがある */
const TIMEOUT_MS = 60_000;

/**
 * この人に AI の機能を出すか。キーが無ければ誰にも出さない。
 * キーがあっても Premium の人だけ（AI の費用を持つ中元さんが、まずテスターだけに出すと決めた。2026-10-14）
 */
export function aiEnabled(profile: Pick<Profile, 'plan'>): boolean {
  return Boolean(env.OPENAI_API_KEY) && profile.plan === 'premium';
}

/**
 * この人の材料を AI に送ってよいか。機能を出す人（aiEnabled）のうち、送るものを読んで同意した人だけ
 * （/log/[day]/menu/new の同意の画面。2026-10-14 に本人・中元さんと決めた）。Server Action はこれで断る
 */
export function aiUsable(profile: Pick<Profile, 'plan' | 'aiConsentAt'>): boolean {
  return aiEnabled(profile) && profile.aiConsentAt !== null;
}

type ResponsesOutput = {
  output?: { type: string; content?: { type: string; text?: string }[] }[];
  error?: { message: string } | null;
};

/**
 * 指示（instructions）と材料（input）を渡し、schema の形の JSON を受け取る。
 * 形はモデル側が守る（strict）が、中身の数の検査は呼んだ側で行う
 */
export async function askJson<T>({
  model,
  instructions,
  input,
  schemaName,
  schema,
}: {
  model: string;
  instructions: string;
  input: string;
  schemaName: string;
  schema: Record<string, unknown>;
}): Promise<T> {
  const key = env.OPENAI_API_KEY;
  if (!key) throw new Error('AI のキーがありません: OPENAI_API_KEY を入れてください');
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      instructions,
      input,
      // 会話を OpenAI 側に残さない
      store: false,
      text: { format: { type: 'json_schema', name: schemaName, schema, strict: true } },
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const data = (await response.json()) as ResponsesOutput;
  if (!response.ok || data.error) {
    throw new Error(`AI の呼び出しに失敗しました (${response.status}): ${data.error?.message}`);
  }
  const text = data.output
    ?.flatMap((item) => item.content ?? [])
    .find((part) => part.type === 'output_text')?.text;
  if (!text) throw new Error('AI の返事に本文がありません');
  return JSON.parse(text) as T;
}
