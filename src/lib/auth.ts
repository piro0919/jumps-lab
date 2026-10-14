import 'server-only';
import { betterAuth } from 'better-auth';
import { after } from 'next/server';
import { env } from '@/env';
import { db } from '@/lib/db';
import { deleteUserVideos } from '@/lib/r2';

/** セッションをクッキーに持たせておく時間（5分） */
const SESSION_CACHE_MINUTES = 5;
const SESSION_CACHE_SECONDS = SESSION_CACHE_MINUTES * 60;

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
    session: { cookieCache: { enabled: true, maxAge: SESSION_CACHE_SECONDS } },
    user: { deleteUser: deleteUserOptions },
  });
}

/** R2 の後片付け。応答の後に回せるときは回す（多いと待たせるため）。回せない場所ではその場で待つ */
function afterResponse(task: () => Promise<void>): Promise<void> {
  try {
    after(task);
    return Promise.resolve();
  } catch {
    return task();
  }
}

/**
 * 本人が設定から自分のアカウントを消す（プライバシーポリシー 7・8 の約束）。順番は Better Auth が決める:
 * 1. ログインからの時間を確かめる（既定の freshAge は1日。過ぎていれば SESSION_EXPIRED で断り、何も消さない）
 * 2. user の行を消す。ほかの表（プロフィール・記録・大会・動画・AI・通知の宛先・セッション・連携）は
 *    on delete cascade で一緒に消える（test/db/account.test.ts）
 * 3. afterDelete: R2 の videos/<userId>/ をまとめて消す（行の無い送りかけの動画も含めて）。応答の後に回す
 * R2 を行より後にするのは、断られたときや行を消すのに失敗したときに、動画だけが先に消えた半端な状態を作らないため。
 * 消した後に届いた送りかけの動画や、R2 で消せなかった分は、サーバーのログに残して先へ進む。
 * それらはバケットの寿命の決まり（expire-videos。送った日から91日）で消える
 */
const deleteUserOptions = {
  enabled: true,
  afterDelete: (user: { id: string }) =>
    afterResponse(async () => {
      try {
        const failed = await deleteUserVideos(user.id);
        if (failed > 0)
          console.error(`アカウントを消したが、動画 ${failed} 本を R2 から消せなかった`);
      } catch (error) {
        console.error('アカウントを消したが、動画を R2 から消せなかった', error);
      }
    }),
};

let auth: ReturnType<typeof createAuth> | undefined;

export function getAuth() {
  auth ??= createAuth();
  return auth;
}
