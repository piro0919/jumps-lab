import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  addAttempt,
  completeVideo,
  deleteVideo,
  getPendingVideo,
  listAttemptsBetween,
  listVideosOnDay,
  releaseStaleVideos,
  releaseVideo,
  reserveVideo,
  videoUsage,
} from '@/lib/data';
import { addProfile, query } from './seed';

/**
 * 動画の枠（src/lib/data.ts の reserveVideo ほか）。合計の上限は届いていない pending も数え、
 * 人ごとの advisory lock で同時に送った分も上限を抜けない
 */

const DAY = '2026-10-14';
const KEEP_DAYS = 90;

/** 1本分の枠の中身。大きさだけ変える */
function video(userId: string, sizeBytes: number, extra: { attemptId?: string | null } = {}) {
  const id = randomUUID();
  return {
    id,
    day: DAY,
    event: 'long_jump' as const,
    kind: 'practice' as const,
    attemptId: extra.attemptId ?? null,
    note: null,
    objectKey: `videos/${userId}/${id}.mp4`,
    contentType: 'video/mp4',
    sizeBytes,
  };
}

/** 期限を過ぎた動画を表に直に入れる（reserveVideo は期限を未来にしか作らない） */
async function addExpired(userId: string, sizeBytes: number) {
  const v = video(userId, sizeBytes);
  await query(
    `insert into video (id, "userId", day, event, kind, "objectKey", "contentType", "sizeBytes", status, "expiresAt")
     values ($1, $2, $3, 'long_jump', 'practice', $4, 'video/mp4', $5, 'ready', now() - interval '1 day')`,
    [v.id, userId, DAY, v.objectKey, sizeBytes],
  );
  return v;
}

describe('reserveVideo', () => {
  it('届いていない pending の枠も合計に数え、上限を超える枠は取らない', async () => {
    const userId = await addProfile();
    expect(await reserveVideo(userId, video(userId, 600), 1000, KEEP_DAYS)).toBe(true);
    expect(await reserveVideo(userId, video(userId, 500), 1000, KEEP_DAYS)).toBe(false);
    expect(await reserveVideo(userId, video(userId, 400), 1000, KEEP_DAYS)).toBe(true);
    expect(await videoUsage(userId)).toBe(1000);
  });

  it('同時に送っても、人ごとのロックで上限を抜けない', async () => {
    const userId = await addProfile();
    const results = await Promise.all(
      Array.from({ length: 5 }, () => reserveVideo(userId, video(userId, 100), 250, KEEP_DAYS)),
    );
    expect(results.filter(Boolean)).toHaveLength(2);
    expect(await videoUsage(userId)).toBe(200);
  });

  it('上限はほかの人の動画を数えない', async () => {
    const [a, b] = await Promise.all([addProfile(), addProfile()]);
    expect(await reserveVideo(a, video(a, 900), 1000, KEEP_DAYS)).toBe(true);
    expect(await reserveVideo(b, video(b, 900), 1000, KEEP_DAYS)).toBe(true);
  });

  it('期限を過ぎた動画は合計に数えない', async () => {
    const userId = await addProfile();
    await addExpired(userId, 900);
    expect(await videoUsage(userId)).toBe(0);
    expect(await reserveVideo(userId, video(userId, 900), 1000, KEEP_DAYS)).toBe(true);
  });

  it('消える時刻を、今から keepDays 日後にする', async () => {
    const userId = await addProfile();
    const v = video(userId, 100);
    await reserveVideo(userId, v, 1000, KEEP_DAYS);
    const [row] = await query<{ days: number }>(
      `select round(extract(epoch from "expiresAt" - now()) / 86400)::int as days from video where id = $1`,
      [v.id],
    );
    expect(row!.days).toBe(KEEP_DAYS);
  });

  it('結び付ける試技は、本人のその日の試技だけ', async () => {
    const [owner, other] = await Promise.all([addProfile(), addProfile()]);
    const attempt = {
      event: 'long_jump' as const,
      kind: 'practice' as const,
      markM: 6,
      windMs: null,
      note: null,
    };
    await addAttempt(owner, { ...attempt, day: DAY });
    await addAttempt(owner, { ...attempt, day: '2026-10-13' });
    await addAttempt(other, { ...attempt, day: DAY });
    const mine = await listAttemptsBetween(owner, '2026-10-13', DAY);
    const [theirs] = await listAttemptsBetween(other, DAY, DAY);
    const sameDay = mine.find((a) => a.day === DAY)!;
    const otherDay = mine.find((a) => a.day !== DAY)!;

    const linked = video(owner, 100, { attemptId: sameDay.id });
    const wrongDay = video(owner, 100, { attemptId: otherDay.id });
    const wrongUser = video(owner, 100, { attemptId: theirs!.id });
    for (const v of [linked, wrongDay, wrongUser]) await reserveVideo(owner, v, 10_000, KEEP_DAYS);

    const rows = await query<{ id: string; attemptId: string | null }>(
      `select id, "attemptId" from video where "userId" = $1`,
      [owner],
    );
    const attemptOf = (id: string) => rows.find((r) => r.id === id)?.attemptId;
    expect(attemptOf(linked.id)).toBe(sameDay.id);
    expect(attemptOf(wrongDay.id)).toBeNull();
    expect(attemptOf(wrongUser.id)).toBeNull();
  });
});

describe('releaseStaleVideos', () => {
  it('3時間たっても届かない枠と、期限を過ぎた動画だけを外して置き場所を返す', async () => {
    const userId = await addProfile();
    const stale = video(userId, 100);
    const fresh = video(userId, 100);
    const oldReady = video(userId, 100);
    for (const v of [stale, fresh, oldReady]) await reserveVideo(userId, v, 10_000, KEEP_DAYS);
    await completeVideo(userId, oldReady.id);
    await query(
      `update video set "createdAt" = now() - interval '3 hours 1 minute' where id = any($1::uuid[])`,
      [[stale.id, oldReady.id]],
    );
    const expired = await addExpired(userId, 100);

    const released = await releaseStaleVideos(userId);
    expect(released.toSorted()).toEqual([stale.objectKey, expired.objectKey].toSorted());
    const left = await query<{ id: string }>(`select id from video where "userId" = $1`, [userId]);
    expect(left.map((r) => r.id).toSorted()).toEqual([fresh.id, oldReady.id].toSorted());
  });

  it('ほかの人の古い枠には触れない', async () => {
    const [a, b] = await Promise.all([addProfile(), addProfile()]);
    const v = video(b, 100);
    await reserveVideo(b, v, 10_000, KEEP_DAYS);
    await query(`update video set "createdAt" = now() - interval '4 hours' where id = $1`, [v.id]);
    expect(await releaseStaleVideos(a)).toEqual([]);
    expect(await getPendingVideo(b, v.id)).not.toBeNull();
  });
});

describe('枠から見せるまで', () => {
  it('pending の枠は本人だけが確かめて ready にでき、ready になった動画だけがその日に並ぶ', async () => {
    const [owner, other] = await Promise.all([addProfile(), addProfile()]);
    const v = video(owner, 100);
    await reserveVideo(owner, v, 10_000, KEEP_DAYS);

    expect(await listVideosOnDay(owner, DAY)).toEqual([]);
    expect(await getPendingVideo(other, v.id)).toBeNull();
    expect(await completeVideo(other, v.id)).toBe(false);
    expect(await getPendingVideo(owner, v.id)).toEqual({ objectKey: v.objectKey, sizeBytes: 100 });

    expect(await completeVideo(owner, v.id)).toBe(true);
    expect(await completeVideo(owner, v.id)).toBe(false);
    expect(await getPendingVideo(owner, v.id)).toBeNull();
    const [shown] = await listVideosOnDay(owner, DAY);
    expect(shown).toMatchObject({ id: v.id, day: DAY, objectKey: v.objectKey, sizeBytes: 100 });
    expect(shown!.expiresAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
    expect(await listVideosOnDay(other, DAY)).toEqual([]);
  });

  it('期限を過ぎた動画はその日に並ばない', async () => {
    const userId = await addProfile();
    await addExpired(userId, 100);
    expect(await listVideosOnDay(userId, DAY)).toEqual([]);
  });

  it('releaseVideo は本人の pending の枠だけを外す（ready の動画は残す）', async () => {
    const [owner, other] = await Promise.all([addProfile(), addProfile()]);
    const pending = video(owner, 100);
    const ready = video(owner, 100);
    for (const v of [pending, ready]) await reserveVideo(owner, v, 10_000, KEEP_DAYS);
    await completeVideo(owner, ready.id);

    expect(await releaseVideo(other, pending.id)).toBeNull();
    expect(await releaseVideo(owner, ready.id)).toBeNull();
    expect(await releaseVideo(owner, pending.id)).toBe(pending.objectKey);
    expect(await videoUsage(owner)).toBe(100);
  });

  it('deleteVideo は本人の動画だけを消す', async () => {
    const [owner, other] = await Promise.all([addProfile(), addProfile()]);
    const v = video(owner, 100);
    await reserveVideo(owner, v, 10_000, KEEP_DAYS);
    await completeVideo(owner, v.id);

    expect(await deleteVideo(other, v.id)).toBeNull();
    expect(await listVideosOnDay(owner, DAY)).toHaveLength(1);
    expect(await deleteVideo(owner, v.id)).toBe(v.objectKey);
    expect(await videoUsage(owner)).toBe(0);
  });
});
