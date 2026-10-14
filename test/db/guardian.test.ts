import { afterEach, describe, expect, it, vi } from 'vitest';
import { addProfile, query } from './seed';

/**
 * 保護者の同意（16歳未満の人の AI コーチ。src/lib/data.ts の guardian の関数）を本物の DB で確かめる:
 * 1. リンクは1回だけ・期限の内だけ使える。送り直すと前のリンクは切れる
 * 2. 24時間に送れる回数を超えたら行を入れない
 * 3. 保護者が同意すると aiUsable が通り、版が上がると聞き直す
 * 4. アカウントを消すとお願いも消える。期限の過ぎた使われていないお願いは Cron が消す
 */

// AI の機能を出す（aiEnabled）ためのキー（テストのためだけの値）。@/env を読み込む前に入れる
vi.hoisted(() => {
  process.env.OPENAI_API_KEY = 'sk-test';
});

const {
  addGuardianRequest,
  agreeAsGuardian,
  findGuardianRequest,
  getProfile,
  latestGuardianRequest,
  purgeGuardianRequests,
  releaseGuardianRequest,
  setPlan,
  supersedeGuardianRequests,
} = await import('@/lib/data');
const { AI_CONSENT_VERSION, aiUsable } = await import('@/lib/ai');
const { hashGuardianToken, newGuardianToken } = await import('@/lib/guardian');

afterEach(() => {
  vi.restoreAllMocks();
});

/** 16歳未満で Premium の人を1人作る */
async function minor(): Promise<string> {
  const userId = await addProfile({ name: 'Kid' });
  await query(`update profile set birthdate = '2013-01-01' where "userId" = $1`, [userId]);
  await setPlan(userId, 'premium');
  return userId;
}

/** お願いを1件入れ、鍵とハッシュと id を返す */
async function request(userId: string, perDay = 3) {
  const token = newGuardianToken();
  const tokenHash = hashGuardianToken(token);
  const id = await addGuardianRequest(userId, {
    guardianEmail: 'parent@example.com',
    tokenHash,
    days: 7,
    perDay,
  });
  return { token, tokenHash, id };
}

describe('保護者へのお願い', () => {
  it('鍵はハッシュだけを持ち、リンクからお願いした人の名前を引ける', async () => {
    const userId = await minor();
    const { token, tokenHash } = await request(userId);
    const rows = await query<{ tokenHash: string }>(
      `select "tokenHash" from guardian_consent_request where "userId" = $1`,
      [userId],
    );
    expect(rows).toEqual([{ tokenHash }]);
    expect(rows[0]!.tokenHash).not.toBe(token);
    expect(await findGuardianRequest(tokenHash)).toMatchObject({ childName: 'Kid', usedAt: null });
    expect(await findGuardianRequest(hashGuardianToken('unknown'))).toBeNull();
  });

  it('リンクは1回だけ使える', async () => {
    const userId = await minor();
    const { tokenHash } = await request(userId);
    expect(await agreeAsGuardian(tokenHash, AI_CONSENT_VERSION)).toBe(true);
    expect(await agreeAsGuardian(tokenHash, AI_CONSENT_VERSION)).toBe(false);
    expect((await findGuardianRequest(tokenHash))?.usedAt).not.toBeNull();
  });

  it('期限の過ぎたリンクでは同意できない', async () => {
    const userId = await minor();
    const { tokenHash, id } = await request(userId);
    await query(
      `update guardian_consent_request set "expiresAt" = now() - interval '1 second' where id = $1`,
      [id],
    );
    expect(await agreeAsGuardian(tokenHash, AI_CONSENT_VERSION)).toBe(false);
    expect((await getProfile(userId))?.aiGuardianConsentVersion).toBeNull();
  });

  it('送り直すと、前のリンクは切れて新しいリンクだけが使える', async () => {
    const userId = await minor();
    const first = await request(userId);
    const second = await request(userId);
    await supersedeGuardianRequests(userId, second.id!);
    expect(await agreeAsGuardian(first.tokenHash, AI_CONSENT_VERSION)).toBe(false);
    expect(await latestGuardianRequest(userId)).toMatchObject({ id: second.id, live: true });
    expect(await agreeAsGuardian(second.tokenHash, AI_CONSENT_VERSION)).toBe(true);
  });

  it('24時間に送れる回数を超えたら入れない。消した（送れなかった）分は数えない', async () => {
    const userId = await minor();
    const limit = 3;
    const made = [];
    for (let i = 0; i < limit; i += 1) made.push((await request(userId, limit)).id);
    expect(made.every((id) => id !== null)).toBe(true);
    expect((await request(userId, limit)).id).toBeNull();

    await releaseGuardianRequest(userId, made[0]!);
    expect((await request(userId, limit)).id).not.toBeNull();
  });

  it('同時に送っても、回数の上限を抜けない', async () => {
    const userId = await minor();
    const results = await Promise.all(Array.from({ length: 5 }, () => request(userId, 3)));
    expect(results.filter((r) => r.id !== null)).toHaveLength(3);
  });

  it('24時間より前に送った分は数えない', async () => {
    const userId = await minor();
    for (let i = 0; i < 3; i += 1) await request(userId, 3);
    await query(
      `update guardian_consent_request set "createdAt" = now() - interval '25 hours' where "userId" = $1`,
      [userId],
    );
    expect((await request(userId, 3)).id).not.toBeNull();
  });
});

describe('保護者の同意と aiUsable', () => {
  it('保護者が同意すると使え、版が上がると保護者に聞き直す', async () => {
    const userId = await minor();
    // 本人が同意していても、16歳未満は使えない
    await query(`update profile set "aiConsentVersion" = $2 where "userId" = $1`, [
      userId,
      AI_CONSENT_VERSION,
    ]);
    expect(aiUsable((await getProfile(userId))!)).toBe(false);

    const { tokenHash } = await request(userId);
    await agreeAsGuardian(tokenHash, AI_CONSENT_VERSION);
    const agreed = (await getProfile(userId))!;
    expect(agreed.aiGuardianConsentVersion).toBe(AI_CONSENT_VERSION);
    expect(aiUsable(agreed)).toBe(true);

    // 版が上がった（前の版の同意しか無い）ときは使えない
    await query(`update profile set "aiGuardianConsentVersion" = $2 where "userId" = $1`, [
      userId,
      AI_CONSENT_VERSION - 1,
    ]);
    expect(aiUsable((await getProfile(userId))!)).toBe(false);
  });

  it('同意し直すと、前の同意の記録と残っていたリンクを片付ける', async () => {
    const userId = await minor();
    const first = await request(userId);
    await agreeAsGuardian(first.tokenHash, AI_CONSENT_VERSION);
    const pending = await request(userId);
    const again = await request(userId);
    await agreeAsGuardian(again.tokenHash, AI_CONSENT_VERSION);

    const rows = await query<{ id: string; used: boolean }>(
      `select id, "usedAt" is not null as used from guardian_consent_request where "userId" = $1`,
      [userId],
    );
    // 使った行は最後の1つだけ。使われていない行のリンクは切れている
    expect(rows.filter((r) => r.used).map((r) => r.id)).toEqual([again.id]);
    expect(await agreeAsGuardian(pending.tokenHash, AI_CONSENT_VERSION)).toBe(false);
  });
});

describe('片付け', () => {
  it('期限の翌日を過ぎた使われていないお願いだけを消し、同意に使った行は残す', async () => {
    const userId = await minor();
    const stale = await request(userId);
    const fresh = await request(userId);
    const used = await request(userId);
    await agreeAsGuardian(used.tokenHash, AI_CONSENT_VERSION);
    await query(
      `update guardian_consent_request set "expiresAt" = now() - interval '2 days'
        where id = any($1::uuid[])`,
      [[stale.id, used.id]],
    );

    expect(await purgeGuardianRequests()).toBeGreaterThanOrEqual(1);
    const left = await query<{ id: string }>(
      `select id from guardian_consent_request where "userId" = $1 order by "createdAt"`,
      [userId],
    );
    expect(left.map((r) => r.id).toSorted()).toEqual([fresh.id, used.id].toSorted());
  });

  it('アカウントを消すと、お願いも消える', async () => {
    const userId = await minor();
    await request(userId);
    await query(`delete from "user" where id = $1`, [userId]);
    expect(
      await query(`select 1 from guardian_consent_request where "userId" = $1`, [userId]),
    ).toEqual([]);
  });
});
