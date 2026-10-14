import { createHash, randomBytes } from 'node:crypto';
import { addDays } from '@/lib/dates';
import { HIGH_FATIGUE } from '@/lib/readiness';

/**
 * チームとコーチ（2026-10-14 に本人と決めた）。コーチは招待のリンクを作り、選手はリンクから同意して入る。
 * 入っているあいだだけ、そのチームのコーチが選手の記録（試技・体調と痛みのメモ・練習メモ・大会・動画）を見られる。
 * 根拠は選手の同意（本人に代わって第三者に渡す。個人情報保護委員会のガイドライン（第三者提供編）と Q&A 7-8）。
 * 16歳未満の人は保護者の同意で入る（src/lib/guardian.ts と同じ線）
 */

/** 招待のリンクの有効期間（日） */
export const INVITE_DAYS = 14;

/** 招待のリンクの鍵のバイト数（256 ビット） */
const INVITE_TOKEN_BYTES = 32;

/** 招待のリンクの鍵の長さの上限。これより長いものは探さずに断る（鍵は 43 文字） */
export const INVITE_TOKEN_MAX_LENGTH = 100;

/** 招待のリンクの鍵。URL にそのまま入る形（base64url）で、推し量れない長さ */
export function newInviteToken(): string {
  return randomBytes(INVITE_TOKEN_BYTES).toString('base64url');
}

/** 鍵のハッシュ。DB にはこれだけを持つ */
export function hashInviteToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** 招待のリンクがまだ使えるか */
export function inviteLinkState(
  invite: { revokedAt: Date | null; expiresAt: Date },
  now: Date,
): 'valid' | 'revoked' | 'expired' {
  if (invite.revokedAt !== null) return 'revoked';
  return invite.expiresAt.getTime() > now.getTime() ? 'valid' : 'expired';
}

/** 痛みのメモと疲労を印にし、一覧に最新の体調と疲労を出す日数（今日を含む直近7日） */
export const FLAG_WINDOW_DAYS = 7;

/** 動画の本数を数える日数（今日を含む直近14日） */
export const VIDEO_WINDOW_DAYS = 14;

/**
 * 疲労の印の線。今日のアドバイスが軽めにする決まった線（src/lib/readiness.ts の HIGH_FATIGUE、仮決め）と同じにする。
 * コーチの画面と選手の画面で「疲れている」の線がずれないように
 */
export const FATIGUE_FLAG = HIGH_FATIGUE;

export type RosterFlag = 'pain' | 'fatigue';

/**
 * 選手の一覧の印。痛みのメモが直近7日にある（pain）、直近7日の最新の疲労が線以上（fatigue）。
 * 古い記録で印を出し続けないように、どちらも直近7日の中だけを見る。today は選手の時間帯の今日
 */
export function rosterFlags(
  member: {
    /** 痛みのメモがある最新の日 */
    lastPainDay: string | null;
    /** 疲労を入れた最新の日と値 */
    latestFatigue: { day: string; value: number } | null;
  },
  today: string,
): RosterFlag[] {
  const from = addDays(today, 1 - FLAG_WINDOW_DAYS);
  const recent = (day: string) => day >= from && day <= today;
  const flags: RosterFlag[] = [];
  if (member.lastPainDay !== null && recent(member.lastPainDay)) flags.push('pain');
  if (
    member.latestFatigue !== null &&
    recent(member.latestFatigue.day) &&
    member.latestFatigue.value >= FATIGUE_FLAG
  ) {
    flags.push('fatigue');
  }
  return flags;
}

/** 印のある選手を先に、印の多い順に。同じなら名前の順 */
export function sortRoster<T extends { name: string; flags: RosterFlag[] }>(
  rows: T[],
  locale: string,
): T[] {
  return rows.toSorted(
    (a, b) => b.flags.length - a.flags.length || a.name.localeCompare(b.name, locale),
  );
}
