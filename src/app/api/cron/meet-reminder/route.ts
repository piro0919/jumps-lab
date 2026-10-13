import { env } from '@/env';
import { isCronRequest } from '@/lib/cron-auth';
import { pushReady, sendMeetReminders } from '@/lib/push';

/**
 * 大会の前日の知らせ（vercel.json の Cron、UTC の 1 時・9 時・17 時）。誰に何を送るかは src/lib/meet-reminder.ts。
 * 鍵（CRON_SECRET）が合わなければ 401。鍵か通知の鍵が揃っていなければ 503。どちらも DB には触れない
 */

const NO_STORE = { 'Cache-Control': 'private, no-store' };

export async function GET(request: Request): Promise<Response> {
  if (!env.CRON_SECRET) {
    return Response.json({ error: 'cron is not configured' }, { status: 503, headers: NO_STORE });
  }
  if (!isCronRequest(request.headers.get('authorization'), env.CRON_SECRET)) {
    return Response.json({ error: 'unauthorized' }, { status: 401, headers: NO_STORE });
  }
  if (!pushReady()) {
    return Response.json({ error: 'push is not configured' }, { status: 503, headers: NO_STORE });
  }
  const run = await sendMeetReminders(new Date());
  return Response.json(run, { headers: NO_STORE });
}
