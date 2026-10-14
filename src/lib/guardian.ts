import { createHash, randomBytes } from 'node:crypto';
import { ageOn } from '@/lib/readiness';

/**
 * AI コーチの同意を、本人と保護者のどちらから取るか（2026-10-14 に本人と決めた）。
 *
 * AI コーチは痛みのメモなど体のことを米国の OpenAI へ送り、その根拠は同意。子どもの同意について:
 * - 個人情報保護委員会の Q&A 1-62 は、同意を取るべき子どもの年齢を一律には決めず、
 *   一般に12歳から15歳までの年齢以下の子どもは法定代理人から同意を取る必要があるとする
 *   https://www.ppc.go.jp/all_faq_index/faq1-q1-62/
 * - 2026年7月10日に成立した改正法（同年7月17日公布、令和8年法律第56号）は、16歳未満の人の同意と通知を
 *   法定代理人に対して行うと書いた。施行は公布から2年以内で、日は政令で決まる（未確認）
 * 高校生（16歳以上）は本人が同意し、16歳未満は保護者がメールのリンクから同意する。高校生を締め出さない
 */

/** この年齢から本人が同意する。下は保護者の同意（改正法の16歳未満に合わせた） */
export const GUARDIAN_AGE = 16;

/** 保護者へのリンクの有効期間（日）。仮決め */
export const GUARDIAN_LINK_DAYS = 7;

/** 保護者へのお願いを送れる回数（24時間あたり）。メールの送り先を他人に向けて連打できないように。仮決め */
export const GUARDIAN_SENDS_PER_DAY = 3;

/**
 * 生年月日を保存するときに、一緒に残す「16歳以上か」（profile."ageDeclared16Plus"）。生年月日が無ければ null（今の答えのまま）。
 * 生年月日で16歳未満と分かった人は false を残し、あとで生年月日を消しても本人だけでは同意できない。
 * false を true に戻せるのは、16歳以上と分かる生年月日の保存だけ（2026-10-14 のコードレビュー）
 */
export function declaredFromBirthdate(birthdate: string | null, today: string): boolean | null {
  return birthdate === null ? null : ageOn(birthdate, today) >= GUARDIAN_AGE;
}

/** 同意を取る相手。ask は生年月日が無く、16歳以上かをまだ答えていない */
export type Consenter = 'self' | 'guardian' | 'ask';

/**
 * 同意を取る相手を決める。生年月日があれば、本人の時間帯の今日の年齢で決める。
 * 無ければ本人の答え（16歳以上か）で決め、答えていなければ聞く
 */
export function consenterFor({
  birthdate,
  declared16Plus,
  today,
}: {
  birthdate: string | null;
  declared16Plus: boolean | null;
  today: string;
}): Consenter {
  if (birthdate !== null) return ageOn(birthdate, today) >= GUARDIAN_AGE ? 'self' : 'guardian';
  if (declared16Plus === null) return 'ask';
  return declared16Plus ? 'self' : 'guardian';
}

/**
 * いまの版の同意が足りているか。保護者の同意はだれでも数え、本人の同意は16歳以上（と答えた人）だけ数える。
 * 保護者が同意したあとで16歳になった人は、そのまま使える（16歳の誕生日に止めない。仮決め）。
 * 本人が同意したあとで生年月日から16歳未満と分かった人は、保護者の同意が要る
 */
export function consentSatisfied(
  consenter: Consenter,
  consent: { self: number | null; guardian: number | null },
  version: number,
): boolean {
  if (consent.guardian === version) return true;
  return consenter === 'self' && consent.self === version;
}

/** リンクの鍵のバイト数（256 ビット） */
const TOKEN_BYTES = 32;

/** リンクの鍵の長さの上限。これより長いものは探さずに断る（鍵は 43 文字。画面と Server Action が使う） */
export const TOKEN_MAX_LENGTH = 100;

/** 保護者へのリンクの鍵。URL にそのまま入る形（base64url）で、推し量れない長さ */
export function newGuardianToken(): string {
  return randomBytes(TOKEN_BYTES).toString('base64url');
}

/** 鍵のハッシュ。DB にはこれだけを持つ */
export function hashGuardianToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** リンクがまだ使えるか */
export function guardianLinkState(
  request: { usedAt: Date | null; expiresAt: Date },
  now: Date,
): 'valid' | 'used' | 'expired' {
  if (request.usedAt !== null) return 'used';
  return request.expiresAt.getTime() > now.getTime() ? 'valid' : 'expired';
}

/** 画面に出すメールアドレス。先頭の1文字とドメインだけを見せる（g***@example.com） */
export function maskEmail(email: string): string {
  const at = email.lastIndexOf('@');
  if (at <= 0) return '***';
  return `${email.slice(0, 1)}***${email.slice(at)}`;
}

/** メールに入れる表示名の長さの上限（文字） */
const MAIL_NAME_MAX_LENGTH = 50;

/** URL やドメインに見える部分（http://…、www.…、example.com/…） */
const URL_LIKE =
  /(?:[a-z][a-z0-9+.-]*:\/\/\S*|www\.\S*|[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,}(?:\/\S*)?)/giu;

/** 制御文字と、文字の向きを変える書式文字（見た目と中身をずらせる） */
const CONTROL = /[\p{Cc}\p{Cf}]/gu;

/**
 * 保護者へのメールの本文に入れる表示名。表示名は本人が自由に決められ、メールは見知らぬ人にも送れるので、
 * リンクとして踏ませられる URL やドメインと制御文字を除き、長さを切る（2026-10-14 のコードレビュー）。
 * 残らなければ null（呼ぶ側が「お子さま」のような言葉に替える）。件名には名前を入れない
 */
export function mailSafeName(name: string): string | null {
  const cleaned = name.replace(CONTROL, ' ').replace(URL_LIKE, ' ').replace(/\s+/gu, ' ').trim();
  const cut = [...cleaned].slice(0, MAIL_NAME_MAX_LENGTH).join('').trim();
  return cut.length > 0 ? cut : null;
}
