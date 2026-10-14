import { createHmac, randomBytes, randomUUID } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { addProfile, query } from './seed';

/**
 * アカウントの削除（src/lib/auth.ts の deleteUser）。本物の Better Auth に、署名したセッションのクッキーで頼む。
 * 1. user を指す表はどれも on delete cascade で、消すとその人の行がどの表にも残らない（ほかの人の行は残る）
 * 2. 動画は行を消したあとで R2 から消す。ログインから時間がたったセッションは断られ、何も消えない
 */

// Better Auth を作るための鍵（テストのためだけの値）。@/env を読み込む前に入れる
vi.hoisted(() => {
  process.env.BETTER_AUTH_SECRET = 'test-secret-for-account-deletion-0123456789';
  process.env.BETTER_AUTH_URL = 'http://localhost:3110';
  process.env.GOOGLE_CLIENT_ID = 'test-client';
  process.env.GOOGLE_CLIENT_SECRET = 'test-secret';
});

const r2 = vi.hoisted(() => ({ deleteUserVideos: vi.fn<(userId: string) => Promise<number>>() }));
vi.mock('@/lib/r2', () => r2);

const { getAuth } = await import('@/lib/auth');

beforeEach(() => {
  r2.deleteUserVideos.mockReset();
  r2.deleteUserVideos.mockResolvedValue(0);
});

/** user を指す外部キーを持つ表（user 自身は除く）。表を足したら、ここに自動で入る */
async function tablesReferencingUser() {
  return query<{ table: string; column: string; onDelete: string }>(
    `select c.conrelid::regclass::text as table, a.attname as column, c.confdeltype as "onDelete"
       from pg_constraint c
       join pg_attribute a on a.attrelid = c.conrelid and a.attnum = any(c.conkey)
      where c.contype = 'f' and c.confrelid = '"user"'::regclass
      order by 1`,
  );
}

/** 1人分の行を、user を指す表すべてに1行ずつ入れる。動画の置き場所を返す */
async function seedEverything(userId: string): Promise<string> {
  const day = '2026-10-14';
  const [attempt] = await query<{ id: string }>(
    `insert into attempt ("userId", day, event, kind, "markM") values ($1, $2, 'long_jump', 'practice', 6.5) returning id`,
    [userId, day],
  );
  const objectKey = `videos/${userId}/${randomUUID()}.mp4`;
  await query(
    `insert into video ("userId", day, event, kind, "attemptId", "objectKey", "contentType", "sizeBytes", status)
     values ($1, $2, 'long_jump', 'practice', $3, $4, 'video/mp4', 100, 'ready')`,
    [userId, day, attempt!.id, objectKey],
  );
  await query(
    `insert into event_target ("userId", event, "seasonGoalM") values ($1, 'long_jump', 7)`,
    [userId],
  );
  await query(`insert into day_log ("userId", day, condition) values ($1, $2, 7)`, [userId, day]);
  await query(`insert into competition ("userId", name, day) values ($1, 'Meet', $2)`, [
    userId,
    day,
  ]);
  await query(
    `insert into practice_menu ("userId", day, level, model, menu) values ($1, $2, 'normal', 'm', '{}')`,
    [userId, day],
  );
  await query(
    `insert into menu_message ("userId", day, role, content) values ($1, $2, 'user', 'hi')`,
    [userId, day],
  );
  await query(`insert into ai_call ("userId", day, kind, model) values ($1, $2, 'menu', 'm')`, [
    userId,
    day,
  ]);
  await query(
    `insert into push_subscription (endpoint, "userId", p256dh, auth, locale) values ($1, $2, 'p', 'a', 'en')`,
    [`https://push.example/${randomUUID()}`, userId],
  );
  await query(
    `insert into account (id, "accountId", "providerId", "userId", "updatedAt") values ($1, $1, 'google', $2, now())`,
    [randomUUID(), userId],
  );
  return objectKey;
}

/** ブラウザが送るのと同じ、署名したセッションのクッキー（scripts/dev-session.ts と同じ作り） */
async function signedIn(userId: string, createdAt = new Date()): Promise<Headers> {
  const token = randomBytes(24).toString('base64url');
  await query(
    `insert into session (id, "expiresAt", token, "createdAt", "updatedAt", "userId")
     values ($1, now() + interval '7 days', $2, $3, now(), $4)`,
    [randomUUID(), token, createdAt, userId],
  );
  const signature = createHmac('sha256', process.env.BETTER_AUTH_SECRET!)
    .update(token)
    .digest('base64');
  return new Headers({
    cookie: `better-auth.session_token=${encodeURIComponent(`${token}.${signature}`)}`,
  });
}

/** その人の行が残っている表と数 */
async function rowsLeft(userId: string) {
  const left: Record<string, number> = {};
  for (const { table, column } of await tablesReferencingUser()) {
    const [row] = await query<{ count: string }>(
      `select count(*) from ${table} where "${column}" = $1`,
      [userId],
    );
    left[table] = Number(row!.count);
  }
  const [user] = await query<{ count: string }>(`select count(*) from "user" where id = $1`, [
    userId,
  ]);
  left.user = Number(user!.count);
  return left;
}

describe('アカウントの削除', () => {
  it('user を指す表は、どれも user を消すと一緒に消える（on delete cascade）', async () => {
    const references = await tablesReferencingUser();
    expect(references.length).toBeGreaterThan(0);
    expect(references.filter((r) => r.onDelete !== 'c')).toEqual([]);
  });

  it('消すと、その人の行はどの表にも残らず、ほかの人の行は残る。動画は R2 からも消す', async () => {
    const userId = await addProfile();
    const otherId = await addProfile();
    await seedEverything(userId);
    await seedEverything(otherId);
    await signedIn(otherId);
    const headers = await signedIn(userId);

    // 入れた行が user を指す表を全部埋めている（表が増えたら seedEverything にも足す）
    const before = await rowsLeft(userId);
    expect(Object.entries(before).filter(([, count]) => count === 0)).toEqual([]);

    const result = await getAuth().api.deleteUser({ headers, body: {} });
    expect(result).toEqual({ success: true, message: 'User deleted' });

    const after = await rowsLeft(userId);
    expect(Object.entries(after).filter(([, count]) => count !== 0)).toEqual([]);
    expect(Object.values(await rowsLeft(otherId)).every((count) => count > 0)).toBe(true);
    expect(r2.deleteUserVideos).toHaveBeenCalledExactlyOnceWith(userId);
  });

  it('R2 で消せなくても、アカウントは消える（残りはバケットの寿命の決まりで消える）', async () => {
    const userId = await addProfile();
    await seedEverything(userId);
    r2.deleteUserVideos.mockRejectedValue(new Error('R2 is down'));
    vi.spyOn(console, 'error').mockImplementation(() => {});

    await getAuth().api.deleteUser({ headers: await signedIn(userId), body: {} });

    expect(Object.values(await rowsLeft(userId)).every((count) => count === 0)).toBe(true);
  });

  it('ログインから1日を過ぎたセッションは SESSION_EXPIRED で断り、行も動画も消さない', async () => {
    const userId = await addProfile();
    await seedEverything(userId);
    const longAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);

    await expect(
      getAuth().api.deleteUser({ headers: await signedIn(userId, longAgo), body: {} }),
    ).rejects.toMatchObject({ body: { code: 'SESSION_EXPIRED' } });

    expect(Object.values(await rowsLeft(userId)).every((count) => count > 0)).toBe(true);
    expect(r2.deleteUserVideos).not.toHaveBeenCalled();
  });
});
