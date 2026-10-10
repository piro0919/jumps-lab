import { randomBytes, createHmac } from 'node:crypto';
import pg from 'pg';
import { scriptEnv } from './lib/env';

/**
 * 手元の確かめ用に、テストの利用者とセッションを作り、ブラウザに入れるクッキーを出す。
 * Google の画面を通さずに、窓を出さないブラウザでログイン後の画面を開くため。
 *
 *   pnpm exec tsx --env-file=.env.local scripts/dev-session.ts         既存のテスト利用者で入る
 *   pnpm exec tsx --env-file=.env.local scripts/dev-session.ts --fresh 記録もプロフィールも消して入り直す
 *   ... scripts/dev-session.ts --fresh --user=e2e-desktop             別の利用者で（e2e が手元の試験用の記録を消さないように）
 *
 * 手元の DB（localhost）にしか書かない。クッキーは Better Auth と同じ形で署名する
 */
// --user=<id> で別の利用者を使う。既定は手元の確かめ用の dev-user
const USER_ID =
  process.argv.find((a) => a.startsWith('--user='))?.slice('--user='.length) || 'dev-user';

async function main() {
  const url = scriptEnv('DATABASE_URL');
  if (!/@(localhost|127\.0\.0\.1)[:/]/.test(url)) throw new Error('手元の DB でしか使えません');
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret) throw new Error('BETTER_AUTH_SECRET が .env.local にありません');

  const pool = new pg.Pool({ connectionString: url });
  try {
    if (process.argv.includes('--fresh')) {
      await pool.query(`delete from "user" where id = $1`, [USER_ID]);
    }
    await pool.query(
      `insert into "user" (id, name, email, "emailVerified") values ($1, 'Dev Jumper', $2, true)
       on conflict (id) do nothing`,
      [USER_ID, USER_ID === 'dev-user' ? 'dev@jumpslab.test' : `${USER_ID}@jumpslab.test`],
    );
    const token = randomBytes(24).toString('base64url');
    await pool.query(
      `insert into session (id, "expiresAt", token, "updatedAt", "userId")
       values ($1, now() + interval '7 days', $2, now(), $3)`,
      [randomBytes(12).toString('hex'), token, USER_ID],
    );
    const signature = createHmac('sha256', secret).update(token).digest('base64');
    console.log(`better-auth.session_token=${encodeURIComponent(`${token}.${signature}`)}`);
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
