import 'server-only';
import { betterAuth } from 'better-auth';
import { env } from '@/env';
import { db } from '@/lib/db';

/**
 * 選手のログイン。Better Auth を自前で持つ（onigiri・Vocafy と同じ作り）。手段は Google だけ。
 * ユーザーとセッションは同じ Postgres の表に入る（db/migrations/0001_auth.sql）。
 * 受け口をこのサイトの住所（/api/auth）に置くので、同意画面にもこのサイトの名前が出る。
 *
 * 初めて使うときに作る。読み込みの時点で作ると、鍵を持たないビルドや CI が落ちる
 */
function createAuth() {
  const { BETTER_AUTH_SECRET, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET } = env;
  if (!BETTER_AUTH_SECRET || !GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    throw new Error(
      'ログインの鍵がありません: BETTER_AUTH_SECRET・GOOGLE_CLIENT_ID・GOOGLE_CLIENT_SECRET を入れてください',
    );
  }
  return betterAuth({
    baseURL: env.BETTER_AUTH_URL,
    database: db(),
    secret: BETTER_AUTH_SECRET,
    socialProviders: {
      google: { clientId: GOOGLE_CLIENT_ID, clientSecret: GOOGLE_CLIENT_SECRET },
    },
    // セッションは署名付きのクッキーに5分持たせ、そのあいだは DB を読みに行かない
    session: { cookieCache: { enabled: true, maxAge: 5 * 60 } },
  });
}

let auth: ReturnType<typeof createAuth> | undefined;

export function getAuth() {
  auth ??= createAuth();
  return auth;
}
