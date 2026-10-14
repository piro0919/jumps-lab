import 'server-only';
import { env } from '@/env';

/**
 * メールを送るところ（16歳未満の人の保護者への、AI コーチの同意のお願い）。Resend の HTTP API を fetch で呼ぶ
 * （送るのは1種類の文面だけなので SDK を入れない）。https://resend.com/docs/api-reference/emails/send-email
 *
 * 送り方は3つ:
 * - resend: RESEND_API_KEY と MAIL_FROM が揃っている
 * - log: 手元の開発（NODE_ENV が development）でキーが無い。送らずに本文をサーバーのログに出す（リンクを手元で踏むため）
 * - none: それ以外。送らず、画面は「今は使えません」を出す。本番（production）では、キーが無くてもログには出さない
 */
export type MailMode = 'resend' | 'log' | 'none';

/** 送り方を決める。NODE_ENV は Next がビルドの時点で埋めるので、本番の束では development にならない */
export function mailMode({
  apiKey,
  from,
  nodeEnv,
}: {
  apiKey: string | undefined;
  from: string | undefined;
  nodeEnv: string | undefined;
}): MailMode {
  if (apiKey && from) return 'resend';
  if (!apiKey && nodeEnv === 'development') return 'log';
  return 'none';
}

const currentMode = () =>
  mailMode({ apiKey: env.RESEND_API_KEY, from: env.MAIL_FROM, nodeEnv: process.env.NODE_ENV });

/** メールを送れるか（log も含む） */
export function mailReady(): boolean {
  return currentMode() !== 'none';
}

/** 返事を待つ上限（ミリ秒） */
const TIMEOUT_MS = 15_000;

/** 1通送る。送れなければ投げる。本文は文字だけ */
export async function sendMail({
  to,
  subject,
  text,
}: {
  to: string;
  subject: string;
  text: string;
}): Promise<void> {
  const mode = currentMode();
  if (mode === 'none')
    throw new Error('メールの設定がありません: RESEND_API_KEY と MAIL_FROM を入れてください');
  if (mode === 'log') {
    console.info(
      `[mail] RESEND_API_KEY が無いので送らずに出します（開発のときだけ）\nTo: ${to}\nSubject: ${subject}\n\n${text}`,
    );
    return;
  }
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: env.MAIL_FROM, to: [to], subject, text }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!response.ok) {
    // 誤りの種類（name）だけを記録（Sentry）に残す。説明の文には宛先が入ることがある
    const body: unknown = await response.json().catch(() => null);
    const name =
      typeof body === 'object' && body !== null && 'name' in body ? String(body.name) : 'unknown';
    throw new Error(`Resend が ${response.status} を返しました: ${name}`);
  }
}
