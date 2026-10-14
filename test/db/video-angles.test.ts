import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  addVideoAngle,
  completeVideo,
  deleteVideo,
  deleteVideoAngle,
  listVideoAngles,
  reserveVideo,
} from '@/lib/data';
import type { Angle } from '@/lib/video-angles';
import { addProfile, query } from './seed';

/**
 * 動画の上で手で測った角度（src/lib/data.ts の addVideoAngle ほか、db/migrations/0026_video_angles.sql）。
 * 持ち主は動画の行で決まり、本人の届いた・期限の過ぎていない動画にだけ読み書きできる
 */

const DAY = '2026-10-14';

/** 本人の動画の枠を取る（届いていない pending のまま） */
async function pendingVideo(userId: string) {
  const id = randomUUID();
  await reserveVideo(
    userId,
    {
      id,
      day: DAY,
      event: 'long_jump',
      kind: 'practice',
      attemptId: null,
      note: null,
      objectKey: `videos/${userId}/${id}.mp4`,
      contentType: 'video/mp4',
      sizeBytes: 100,
    },
    10_000,
    90,
  );
  return id;
}

/** 本人の届いた動画を1本足す */
async function readyVideo(userId: string) {
  const id = await pendingVideo(userId);
  await completeVideo(userId, id);
  return id;
}

const knee = (videoId: string, extra: Partial<Angle> = {}) => ({
  videoId,
  name: 'knee' as const,
  kind: 'angle' as const,
  time: 1.234,
  points: [
    { x: 0.1, y: 0.2 },
    { x: 0.3, y: 0.4 },
    { x: 0.5, y: 0.25 },
  ],
  frameWidth: 1080,
  frameHeight: 1920,
  degrees: 123.4,
  ...extra,
});

/** 保存できた測定を返す（できなければテストを落とす） */
async function save(userId: string, angle: ReturnType<typeof knee>, limit = 30) {
  const result = await addVideoAngle(userId, angle, limit);
  if (typeof result === 'string') throw new Error(result);
  return result;
}

describe('video_angle', () => {
  it('保存した測定を、点・時刻（ミリ秒）・大きさ・度数のまま、時刻の順に読む', async () => {
    const userId = await addProfile();
    const videoId = await readyVideo(userId);
    const later = await save(userId, knee(videoId, { time: 2.5 }));
    const first = await save(userId, knee(videoId));
    const lean = await save(
      userId,
      knee(videoId, {
        name: 'trunk',
        kind: 'lean',
        time: 0.5,
        points: [
          { x: 0.5, y: 0.9 },
          { x: 0.6, y: 0.1 },
        ],
        degrees: 12.5,
      }),
    );
    const list = await listVideoAngles(userId, [videoId]);
    expect(list[videoId]).toEqual([lean, first, later]);
    expect(list[videoId]?.[1]).toMatchObject({
      time: 1.234,
      frameWidth: 1080,
      frameHeight: 1920,
      degrees: 123.4,
      points: knee(videoId).points,
    });
    expect(list[videoId]?.[0]?.points).toHaveLength(2);
  });

  it('ほかの人の動画・届いていない動画・期限を過ぎた動画には足せず、読めず、消せない', async () => {
    const [owner, other] = await Promise.all([addProfile(), addProfile()]);
    const mine = await readyVideo(owner);
    const saved = await save(owner, knee(mine));
    const pending = await pendingVideo(owner);
    const expired = await readyVideo(owner);
    const onExpired = await save(owner, knee(expired));
    await query(`update video set "expiresAt" = now() - interval '1 day' where id = $1`, [expired]);

    expect([
      await addVideoAngle(other, knee(mine), 30),
      await addVideoAngle(owner, knee(pending), 30),
      await addVideoAngle(owner, knee(expired), 30),
      await addVideoAngle(owner, knee(randomUUID()), 30),
    ]).toEqual(['denied', 'denied', 'denied', 'denied']);
    expect(await listVideoAngles(other, [mine])).toEqual({ [mine]: [] });
    expect(await listVideoAngles(owner, [expired])).toEqual({ [expired]: [] });
    expect(await deleteVideoAngle(other, saved.id)).toBe(false);
    expect(await deleteVideoAngle(owner, onExpired.id)).toBe(false);
    expect((await listVideoAngles(owner, [mine]))[mine]).toEqual([saved]);
  });

  it('本人は1つずつ消せる', async () => {
    const userId = await addProfile();
    const videoId = await readyVideo(userId);
    const a = await save(userId, knee(videoId));
    const b = await save(userId, knee(videoId, { time: 2 }));
    expect(await deleteVideoAngle(userId, a.id)).toBe(true);
    expect(await deleteVideoAngle(userId, a.id)).toBe(false);
    expect((await listVideoAngles(userId, [videoId]))[videoId]).toEqual([b]);
  });

  it('1本の上限まで足したら、それ以上は limit。同時に足しても上限を抜けない', async () => {
    const userId = await addProfile();
    const videoId = await readyVideo(userId);
    const results = await Promise.all(
      Array.from({ length: 5 }, (_, i) => addVideoAngle(userId, knee(videoId, { time: i }), 3)),
    );
    expect(results.filter((r) => r === 'limit')).toHaveLength(2);
    expect((await listVideoAngles(userId, [videoId]))[videoId]).toHaveLength(3);
  });

  it('動画を消すと、その動画の測定も消える', async () => {
    const userId = await addProfile();
    const videoId = await readyVideo(userId);
    await save(userId, knee(videoId));
    await deleteVideo(userId, videoId);
    expect(await query(`select 1 from video_angle where "videoId" = $1`, [videoId])).toEqual([]);
  });

  it('アカウントを消すと、動画ごと測定も消える', async () => {
    const userId = await addProfile();
    const videoId = await readyVideo(userId);
    await save(userId, knee(videoId));
    await query(`delete from "user" where id = $1`, [userId]);
    expect(await query(`select 1 from video_angle where "videoId" = $1`, [videoId])).toEqual([]);
  });

  it('表の check が、範囲の外の点・測り方と合わない点の数・90° を超える傾きを止める', async () => {
    const userId = await addProfile();
    const videoId = await readyVideo(userId);
    const insert = (columns: Record<string, unknown>) => {
      const row: Record<string, unknown> = {
        name: 'knee',
        kind: 'angle',
        timeMs: 1000,
        frameWidth: 100,
        frameHeight: 100,
        x1: 0.1,
        y1: 0.1,
        x2: 0.2,
        y2: 0.2,
        x3: 0.3,
        y3: 0.1,
        degrees: 90,
        ...columns,
      };
      const names = Object.keys(row);
      return query(
        `insert into video_angle ("videoId", ${names.map((n) => `"${n}"`).join(', ')})
         values ($1, ${names.map((_, i) => `$${i + 2}`).join(', ')})`,
        [videoId, ...Object.values(row)],
      ).then(
        () => 'ok',
        () => 'rejected',
      );
    };
    const results = [];
    for (const columns of [
      {},
      { x1: 1.5 },
      { y2: -0.1 },
      { x3: null, y3: null },
      { y3: null },
      { kind: 'lean', degrees: 45 },
      { kind: 'lean', x3: null, y3: null, degrees: 95 },
      { kind: 'lean', x3: null, y3: null, degrees: 45 },
      { name: 'elbow' },
      { timeMs: 600_001 },
      { degrees: 181 },
      { frameWidth: 0 },
    ]) {
      results.push(await insert(columns));
    }
    expect(results).toEqual([
      'ok',
      'rejected',
      'rejected',
      'rejected',
      'rejected',
      'rejected',
      'rejected',
      'ok',
      'rejected',
      'rejected',
      'rejected',
      'rejected',
    ]);
  });
});
