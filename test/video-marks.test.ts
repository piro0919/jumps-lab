import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  MARK_MAX_SECONDS,
  approachTime,
  compareIntervals,
  fromMs,
  intervals,
  markInputSchema,
  nextMark,
  toMarks,
  toMs,
} from '@/lib/video-marks';

/** 動画の時間の目印と、あいだの時間の計算（src/lib/video-marks.ts） */

describe('toMs と fromMs', () => {
  it('秒を整数のミリ秒にし、ミリ秒を秒に戻す（DB の "timeMs" との行き来）', () => {
    expect([toMs(1.2344), toMs(1.2346), toMs(0), fromMs(1234), fromMs(toMs(2.5))]).toEqual([
      1234, 1235, 0, 1.234, 2.5,
    ]);
  });
});

describe('intervals', () => {
  it('置いた目印を決まった順に並べ、隣どうしのあいだを出す', () => {
    expect(intervals({ takeoff: 2.5, step1: 2.27, step2: 2.0 })).toEqual([
      { from: 'step2', to: 'step1', seconds: 0.27 },
      { from: 'step1', to: 'takeoff', seconds: 0.23 },
    ]);
  });

  it('抜けている目印は飛ばして、その前後を隣とみなす', () => {
    expect(intervals({ step3: 1, takeoff: 1.75 })).toEqual([
      { from: 'step3', to: 'takeoff', seconds: 0.75 },
    ]);
  });

  it('順が逆のあいだと、同じ時刻のあいだは出さない', () => {
    expect(intervals({ step1: 2, takeoff: 1.9, landing: 2.6 })).toEqual([
      { from: 'takeoff', to: 'landing', seconds: 0.7 },
    ]);
    expect(intervals({ step1: 2, takeoff: 2 })).toEqual([]);
  });

  it('小数の誤差を残さずミリ秒に丸める', () => {
    expect(intervals({ step1: 0.1, takeoff: 0.3 })[0]?.seconds).toBe(0.2);
  });

  it('目印が1つ以下なら空', () => {
    expect(intervals({})).toEqual([]);
    expect(intervals({ takeoff: 1 })).toEqual([]);
  });
});

describe('approachTime', () => {
  it('助走の始まりから踏み切りまで。どちらかが無いか逆なら null', () => {
    expect(approachTime({ start: 0.5, step1: 3, takeoff: 3.25 })).toBe(2.75);
    expect(approachTime({ takeoff: 3 })).toBeNull();
    expect(approachTime({ start: 4, takeoff: 3 })).toBeNull();
  });
});

describe('compareIntervals', () => {
  it('同じ目印の組どうしを並べ、両方あるときだけ B − A を出す', () => {
    const rows = compareIntervals(
      { step2: 1, step1: 1.25, takeoff: 1.47 },
      { step1: 2.1, takeoff: 2.35, landing: 3 },
    );
    expect(rows).toEqual([
      { key: 'step2-step1', from: 'step2', to: 'step1', a: 0.25, b: null, diff: null },
      { key: 'step1-takeoff', from: 'step1', to: 'takeoff', a: 0.22, b: 0.25, diff: 0.03 },
      { key: 'takeoff-landing', from: 'takeoff', to: 'landing', a: null, b: 0.65, diff: null },
    ]);
  });

  it('助走の時間を最後の行にまとめる。始まりと踏み切りが隣どうしでも、行を重ねない', () => {
    const rows = compareIntervals({ start: 0, step1: 2, takeoff: 2.2 }, { start: 0.5, takeoff: 3 });
    expect(rows.map((r) => r.key)).toEqual(['start-step1', 'step1-takeoff', 'approach']);
    expect(rows.at(-1)).toEqual({
      key: 'approach',
      from: 'start',
      to: 'takeoff',
      a: 2.2,
      b: 2.5,
      diff: 0.3,
    });
  });

  it('差は B が遅ければ正、速ければ負', () => {
    const [row] = compareIntervals({ step1: 1, takeoff: 1.3 }, { step1: 1, takeoff: 1.2 });
    expect(row?.diff).toBe(-0.1);
  });
});

describe('nextMark', () => {
  it('置いた目印のあとの、まだ置いていない最初の目印。無ければ頭から探す', () => {
    expect(nextMark({})).toBe('start');
    expect(nextMark({ start: 0 }, 'start')).toBe('step3');
    expect(nextMark({ start: 0, step1: 1, takeoff: 2 }, 'step1')).toBe('landing');
    expect(nextMark({ start: 0, landing: 3 }, 'landing')).toBe('step3');
  });

  it('全部置いてあれば着地', () => {
    const all = { start: 0, step3: 1, step2: 2, step1: 3, takeoff: 4, landing: 5 };
    expect(nextMark(all, 'step2')).toBe('landing');
  });
});

describe('toMarks', () => {
  it('知っている名前の、0 以上の数だけを残す', () => {
    expect(toMarks({ takeoff: 1.5, landing: -1, step1: '2', other: 3 })).toEqual({ takeoff: 1.5 });
    expect(toMarks(null)).toEqual({});
    expect(toMarks([1, 2])).toEqual({});
  });
});

describe('markInputSchema', () => {
  const videoId = randomUUID();

  it('時刻をミリ秒に丸め、null は外すこととして受ける', () => {
    expect(markInputSchema.parse({ videoId, mark: 'takeoff', time: 2.34567 })).toEqual({
      videoId,
      mark: 'takeoff',
      time: 2.346,
    });
    expect(markInputSchema.parse({ videoId, mark: 'start', time: null }).time).toBeNull();
  });

  it('知らない目印、範囲の外の時刻、数でない時刻、id でない値は受けない', () => {
    const bad = [
      { videoId, mark: 'hop', time: 1 },
      { videoId, mark: 'takeoff', time: -0.001 },
      { videoId, mark: 'takeoff', time: MARK_MAX_SECONDS + 1 },
      { videoId, mark: 'takeoff', time: Number.NaN },
      { videoId, mark: 'takeoff', time: Number.POSITIVE_INFINITY },
      { videoId, mark: 'takeoff', time: '1.2' },
      { videoId: 'x', mark: 'takeoff', time: 1 },
    ];
    expect(bad.map((input) => markInputSchema.safeParse(input).success)).toEqual(
      bad.map(() => false),
    );
  });
});
