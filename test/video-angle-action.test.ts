import { randomUUID } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ANGLES_PER_VIDEO } from '@/lib/limits';

/**
 * 角度を保存する Server Action（src/app/actions/videos.ts の addVideoAngleAction）。DB は差し替える:
 * 1. 度数は送られてきた値を使わず、点と本来の幅・高さから求め直して書く
 * 2. 点が重なって度数が決まらない・形が合わない入力は書かない
 * 3. 持ち主でなければ generic、上限なら angleLimit
 */

vi.mock('next/cache', () => ({ refresh: vi.fn() }));
vi.mock('@/lib/viewer', () => ({
  requireViewer: async () => ({ userId: 'me', name: 'Me', email: 'me@example.com', image: null }),
}));
vi.mock('@/lib/r2', () => ({}));
const data = vi.hoisted(() => ({
  addVideoAngle: vi.fn<(...args: unknown[]) => Promise<unknown>>(async (_userId, angle) => ({
    id: 'saved',
    ...(angle as object),
  })),
  deleteVideoAngle: vi.fn(async () => true),
}));
vi.mock('@/lib/data', () => data);

const { addVideoAngleAction } = await import('@/app/actions/videos');

beforeEach(() => {
  vi.clearAllMocks();
});

const input = {
  videoId: randomUUID(),
  name: 'knee' as const,
  kind: 'angle' as const,
  time: 1.5,
  // 縦長の動画で直角になる3点（割合のままでは直角にならない）
  points: [
    { x: 0.6, y: 0.5 },
    { x: 0.5, y: 0.5 },
    { x: 0.5, y: 0.4 },
  ],
  frameWidth: 1080,
  frameHeight: 1920,
};

describe('addVideoAngleAction', () => {
  it('送られてきた度数は使わず、点から求め直した度数を書く', async () => {
    const result = await addVideoAngleAction({ ...input, degrees: 12 } as typeof input);
    expect(result.ok).toBe(true);
    expect(data.addVideoAngle).toHaveBeenCalledWith(
      'me',
      expect.objectContaining({ videoId: input.videoId, degrees: 90 }),
      ANGLES_PER_VIDEO,
    );
  });

  it('点が重なる・点の数が合わない・範囲の外の入力は書かない', async () => {
    const results = [
      await addVideoAngleAction({ ...input, points: [input.points[1]!, ...input.points.slice(1)] }),
      await addVideoAngleAction({ ...input, points: input.points.slice(0, 2) }),
      await addVideoAngleAction({ ...input, points: [{ x: 2, y: 0 }, ...input.points.slice(1)] }),
    ];
    expect(results).toEqual([
      { ok: false, error: 'generic' },
      { ok: false, error: 'generic' },
      { ok: false, error: 'generic' },
    ]);
    expect(data.addVideoAngle).not.toHaveBeenCalled();
  });

  it('持ち主でなければ generic、上限なら angleLimit、DB が落ちれば generic', async () => {
    data.addVideoAngle.mockResolvedValueOnce('denied');
    data.addVideoAngle.mockResolvedValueOnce('limit');
    data.addVideoAngle.mockRejectedValueOnce(new Error('down'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const results = [
      await addVideoAngleAction(input),
      await addVideoAngleAction(input),
      await addVideoAngleAction(input),
    ];
    expect(results).toEqual([
      { ok: false, error: 'generic' },
      { ok: false, error: 'angleLimit' },
      { ok: false, error: 'generic' },
    ]);
  });
});
