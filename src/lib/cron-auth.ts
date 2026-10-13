import { timingSafeEqual } from 'node:crypto';

/**
 * Cron の要求か。Vercel の Cron は Authorization: Bearer <CRON_SECRET> を付けてくる。
 * 鍵が無ければ誰も通さない。長さと中身の違いで、かかる時間を変えない
 */
export function isCronRequest(header: string | null, secret: string | undefined): boolean {
  if (!secret || header === null) return false;
  const given = Buffer.from(header);
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}
