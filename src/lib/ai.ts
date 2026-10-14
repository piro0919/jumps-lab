import 'server-only';
import { env } from '@/env';
import type { Profile } from '@/lib/data';
import { todayIn } from '@/lib/dates';
import { type Consenter, consenterFor, consentSatisfied } from '@/lib/guardian';

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
 * AI コーチの同意の画面の版。送る項目を変えたら（src/app/actions/menu.ts の menuContext）上げる。
 * 前の版に同意した人には、もう一度同意の画面を出す。
 * 2: 自己ベストと今季ベストを足した（2026-10-14）
 */
export const AI_CONSENT_VERSION = 2;

/** 同意を取る相手を決めるのに使うプロフィールの項目 */
type ConsentProfile = Pick<
  Profile,
  | 'plan'
  | 'aiConsentVersion'
  | 'aiGuardianConsentVersion'
  | 'birthdate'
  | 'ageDeclared16Plus'
  | 'timeZone'
>;

/** この人の同意を、本人と保護者のどちらから取るか（src/lib/guardian.ts）。年齢は本人の時間帯の今日で数える */
export function aiConsenter(profile: ConsentProfile, now: Date = new Date()): Consenter {
  return consenterFor({
    birthdate: profile.birthdate,
    declared16Plus: profile.ageDeclared16Plus,
    today: todayIn(profile.timeZone, now),
  });
}

/**
 * この人の材料を AI に送ってよいか。機能を出す人（aiEnabled）のうち、送るものを読んでいまの版に同意した人だけ
 * （/log/[day]/menu/new の同意の画面。2026-10-14 に本人・中元さんと決めた）。Server Action はこれで断る。
 * 16歳未満（と答えた人）は保護者の同意が要る（src/lib/guardian.ts。2026-10-14）
 */
export function aiUsable(profile: ConsentProfile, now: Date = new Date()): boolean {
  return (
    aiEnabled(profile) &&
    consentSatisfied(
      aiConsenter(profile, now),
      { self: profile.aiConsentVersion, guardian: profile.aiGuardianConsentVersion },
      AI_CONSENT_VERSION,
    )
  );
}

type ResponsesOutput = {
  output?: { type: string; content?: { type: string; text?: string }[] }[];
  error?: { message?: string; type?: string; code?: string | null } | null;
};

/**
 * AI が答えられなかった理由の種類。選手に出す文言を分けるため（ながら介護の NK-2517 にならった。
 * 理由が1つの文言だけだと、残高切れでも「電波のせい」と思われた）。
 * - auth: キーが無い・効かない・その国から使えない（待っても直らない）
 * - quota: OpenAI の残高や上限を使い切った（待っても直らない）
 * - busy: 混雑・OpenAI 側の不調・時間切れ・通信の失敗（少し待てば直りうる）
 * - unknown: それ以外（こちらの送り方の誤り、返事が読めないなど）
 * アプリが自分で決めた回数の上限（AI_CALL_LIMITS）はこれとは別で、menu.ts が先に断る
 */
export type AiErrorKind = 'auth' | 'quota' | 'busy' | 'unknown';

/** AI の呼び出しの失敗。message は記録（console.error → Sentry）にだけ使い、画面には kind だけを返す */
export class AiError extends Error {
  readonly kind: AiErrorKind;

  constructor(kind: AiErrorKind, message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'AiError';
    this.kind = kind;
  }
}

const HTTP_UNAUTHORIZED = 401;
const HTTP_FORBIDDEN = 403;
const HTTP_TOO_MANY_REQUESTS = 429;
const HTTP_SERVER_ERROR_MIN = 500;

/**
 * 429 のうち、残高や上限を使い切ったもの。混雑（rate_limit_error, slow_down）と同じ 429 で返るため、
 * 本文の error.type と error.code で分ける。OpenAI の Error codes のページで確かめた（2026-10-14）:
 * https://developers.openai.com/api/docs/guides/error-codes
 * insufficient_quota は type に入ることがあり、billing_hard_limit_reached は古い返し方
 */
const QUOTA_CODES: ReadonlySet<string> = new Set([
  'insufficient_quota',
  'credit_balance_exhausted',
  'organization_spend_limit_exceeded',
  'project_spend_limit_exceeded',
  'organization_usage_limit_exceeded',
  'billing_hard_limit_reached',
]);

/**
 * 失敗の種類を決める。status と body は返事が来たとき、thrown は fetch そのものが投げたとき。
 * 401/403 → auth、429 は本文で quota か busy、5xx と時間切れ・通信の失敗 → busy、ほかは unknown
 */
export function classifyAiFailure({
  status,
  body,
  thrown,
}: {
  status?: number;
  body?: unknown;
  thrown?: unknown;
}): AiErrorKind {
  if (status === undefined) {
    // AbortSignal.timeout は TimeoutError、手で止めたときは AbortError、通信の失敗は fetch の TypeError
    if (thrown instanceof Error) {
      if (thrown.name === 'TimeoutError' || thrown.name === 'AbortError') return 'busy';
      if (thrown instanceof TypeError) return 'busy';
    }
    return 'unknown';
  }
  if (status === HTTP_UNAUTHORIZED || status === HTTP_FORBIDDEN) return 'auth';
  if (status === HTTP_TOO_MANY_REQUESTS) {
    const error =
      typeof body === 'object' && body !== null
        ? (body as { error?: { type?: unknown; code?: unknown } | null }).error
        : undefined;
    const marks = [error?.type, error?.code].filter((v): v is string => typeof v === 'string');
    return marks.some((mark) => QUOTA_CODES.has(mark)) ? 'quota' : 'busy';
  }
  if (status >= HTTP_SERVER_ERROR_MIN) return 'busy';
  return 'unknown';
}

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
  if (!key) throw new AiError('auth', 'AI のキーがありません: OPENAI_API_KEY を入れてください');
  let response: Response;
  try {
    response = await fetch('https://api.openai.com/v1/responses', {
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
  } catch (thrown) {
    throw new AiError(classifyAiFailure({ thrown }), 'AI に届きませんでした', { cause: thrown });
  }
  // 混雑や不調のときは JSON でない本文（HTML など）が返ることもある
  let data: ResponsesOutput;
  try {
    data = (await response.json()) as ResponsesOutput;
  } catch (thrown) {
    // 200 のあとに本文の読み込みが時間切れになったときも、混雑として扱う
    const kind = response.ok
      ? classifyAiFailure({ thrown })
      : classifyAiFailure({ status: response.status });
    throw new AiError(kind, `AI の返事が読めません (${response.status})`, { cause: thrown });
  }
  if (!response.ok || data.error) {
    const kind = classifyAiFailure({ status: response.status, body: data });
    const { type, code, message } = data.error ?? {};
    throw new AiError(
      kind,
      `AI の呼び出しに失敗しました (${response.status} ${type ?? '-'}/${code ?? '-'}): ${message}`,
    );
  }
  const text = data.output
    ?.flatMap((item) => item.content ?? [])
    .find((part) => part.type === 'output_text')?.text;
  if (!text) throw new AiError('unknown', 'AI の返事に本文がありません');
  return JSON.parse(text) as T;
}
