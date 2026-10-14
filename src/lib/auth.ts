import 'server-only';
import { betterAuth } from 'better-auth';
import { env } from '@/env';
import { videoObjectKeys } from '@/lib/data';
import { db } from '@/lib/db';
import { deleteObjects } from '@/lib/r2';

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

/**
 * アカウントを消すとき、行を消す前に読んだ動画の置き場所。Better Auth は beforeDelete と afterDelete に
 * 同じ user のオブジェクトを渡すので、それを鍵にして受け渡す（消し終われば捨てられる）
 */
const pendingVideoKeys = new WeakMap<object, string[]>();

/**
 * 本人が設定から自分のアカウントを消す（プライバシーポリシー 7・8 の約束）。順番は Better Auth が決める:
 * 1. ログインからの時間を確かめる（既定の freshAge は1日。過ぎていれば SESSION_EXPIRED で断り、何も消さない）
 * 2. beforeDelete: 動画の置き場所を読むだけ（ここではまだ消さない）
 * 3. user の行を消す。ほかの表（プロフィール・記録・大会・動画・AI・通知の宛先・セッション・連携）は
 *    on delete cascade で一緒に消える（test/db/account.test.ts）
 * 4. afterDelete: R2 の動画を消す
 * R2 を行より後にするのは、断られたときや行を消すのに失敗したときに、動画だけが先に消えた半端な状態を作らないため。
 * R2 で消せなかった分はサーバーのログに残して先へ進む。残った動画はバケットの寿命の決まり（expire-videos。
 * 送った日から91日）で消える
 */
const deleteUserOptions = {
  enabled: true,
  beforeDelete: async (user: { id: string }) => {
    pendingVideoKeys.set(user, await videoObjectKeys(user.id));
  },
  afterDelete: async (user: { id: string }) => {
    const keys = pendingVideoKeys.get(user) ?? [];
    pendingVideoKeys.delete(user);
    try {
      const failed = await deleteObjects(keys);
      if (failed > 0)
        console.error(`アカウントを消したが、動画 ${failed} 本を R2 から消せなかった`);
    } catch (error) {
      console.error('アカウントを消したが、動画を R2 から消せなかった', error);
    }
  },
};

let auth: ReturnType<typeof createAuth> | undefined;

export function getAuth() {
  auth ??= createAuth();
  return auth;
}
