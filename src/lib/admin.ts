import 'server-only';
import { env } from '@/env';

/**
 * 管理の画面（/admin）に入れる人。本人と中元さんだけが使い、できるのはプランの切り替えだけ（2026-10-14）。
 * 誰が入れるかは環境変数 ADMIN_EMAILS（Google のメールをカンマで区切る）で決め、DB には持たない
 */

/** 何も探していないときに出す、新しく登録した人の数 */
export const ADMIN_LIST_LIMIT = 50;

/** 探す語の字数 */
export const ADMIN_QUERY_MAX_LENGTH = 100;

/** ADMIN_EMAILS を読む。前後の空白を落とし、大文字と小文字は区別しない。空の項目は捨てる */
export function parseAdminEmails(raw: string | undefined): Set<string> {
  return new Set(
    (raw ?? '')
      .split(',')
      .map((email) => email.trim().toLowerCase())
      .filter((email) => email !== ''),
  );
}

/** この人が管理の画面に入れるか。メールはログインしている人のもの（requireViewer）だけを渡す */
export function isAdmin(email: string): boolean {
  return parseAdminEmails(env.ADMIN_EMAILS).has(email.trim().toLowerCase());
}
