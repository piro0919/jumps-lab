import { describe, expect, it } from 'vitest';
import {
  DEFAULT_FPS,
  align,
  fpsFromInterval,
  isPlaying,
  stepFrame,
  toLocal,
  toShared,
} from '@/lib/video-sync';

/** 2本の動画を合わせる点で揃えて並べる計算（src/lib/video-sync.ts） */

describe('align', () => {
  it('合わせる点が無ければ頭で揃え、長い方の終わりまでを時間軸にする', () => {
    expect(align({ duration: 4, sync: 0 }, { duration: 6, sync: 0 })).toEqual({
      startA: 0,
      startB: 0,
      length: 6,
      endsFirst: 'a',
    });
  });

  it('合わせる点が遅い方を先に始め、両方の合わせる点を同じ時刻にする', () => {
    const a = { duration: 5, sync: 3 };
    const b = { duration: 5, sync: 1 };
    const result = align(a, b);
    expect(result.startA).toBe(0);
    expect(result.startB).toBe(2);
    expect(result.startA + a.sync).toBe(result.startB + b.sync);
    // B は 2 秒遅れて始まり 7 秒で終わる
    expect(result.length).toBe(7);
    expect(result.endsFirst).toBe('a');
  });

  it('B の合わせる点が遅ければ、B が先に始まる', () => {
    const result = align({ duration: 3, sync: 0.5 }, { duration: 10, sync: 2.5 });
    expect(result.startA).toBe(2);
    expect(result.startB).toBe(0);
    expect(result.length).toBe(10);
    expect(result.endsFirst).toBe('a');
  });

  it('同じ時刻に終わるなら、先に終わる方は無い', () => {
    expect(align({ duration: 4, sync: 1 }, { duration: 5, sync: 2 }).endsFirst).toBeNull();
  });

  it('動画の長さを超える合わせる点は、終わりに収める', () => {
    const result = align({ duration: 2, sync: 9 }, { duration: 4, sync: 0 });
    expect(result.startA).toBe(0);
    expect(result.startB).toBe(2);
    expect(result.length).toBe(6);
  });

  it('長さが分からないうちは 0 とみなし、時間軸を負にしない', () => {
    expect(align({ duration: Number.NaN, sync: 1 }, { duration: 3, sync: 0 }).length).toBe(3);
  });
});

describe('toLocal と toShared', () => {
  it('共通の時刻を、その動画の秒にして戻せる', () => {
    expect(toLocal(3.5, 2, 5)).toBe(1.5);
    expect(toShared(1.5, 2)).toBe(3.5);
  });

  it('始まる前は頭、終わったあとは最後で止める', () => {
    expect(toLocal(1, 2, 5)).toBe(0);
    expect(toLocal(9, 2, 5)).toBe(5);
  });

  it('揃えたあと、合わせる点の時刻では両方が合わせる点を指す', () => {
    const a = { duration: 6, sync: 4.2 };
    const b = { duration: 3, sync: 0.8 };
    const { startA, startB } = align(a, b);
    const moment = toShared(a.sync, startA);
    expect(toLocal(moment, startA, a.duration)).toBeCloseTo(4.2);
    expect(toLocal(moment, startB, b.duration)).toBeCloseTo(0.8);
  });
});

describe('isPlaying', () => {
  it('始まってから終わるまでだけ動いている', () => {
    expect(isPlaying(1.9, 2, 3)).toBe(false);
    expect(isPlaying(2, 2, 3)).toBe(true);
    expect(isPlaying(4.9, 2, 3)).toBe(true);
    expect(isPlaying(5, 2, 3)).toBe(false);
  });
});

describe('fpsFromInterval', () => {
  it('コマの間隔から速さを丸めて出す', () => {
    expect(fpsFromInterval(1 / 30)).toBe(30);
    expect(fpsFromInterval(1 / 59.94)).toBe(60);
    expect(fpsFromInterval(1 / 120)).toBe(120);
  });

  it('シークの跳びや止まっていた分は数えない', () => {
    expect(fpsFromInterval(0)).toBeNull();
    expect(fpsFromInterval(-0.03)).toBeNull();
    expect(fpsFromInterval(0.5)).toBeNull();
    expect(fpsFromInterval(1 / 1000)).toBeNull();
  });
});

describe('stepFrame', () => {
  it('1コマ分だけ進めて戻す', () => {
    expect(stepFrame(1, 1, 30, 10)).toBeCloseTo(1 + 1 / 30);
    expect(stepFrame(1, -1, 60, 10)).toBeCloseTo(1 - 1 / 60);
  });

  it('時間軸の外へは出ない', () => {
    expect(stepFrame(0, -1, 30, 10)).toBe(0);
    expect(stepFrame(10, 1, 30, 10)).toBe(10);
  });

  it('速さが分からなければ既定の速さで進める', () => {
    expect(stepFrame(0, 1, 0, 10)).toBeCloseTo(1 / DEFAULT_FPS);
  });
});
