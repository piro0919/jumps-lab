import { describe, expect, it } from 'vitest';
import { computeBests, type ManualBests, type MarkRow } from '@/lib/bests';

const none: ManualBests = { pbM: null, sbM: null, sbSeason: null, practiceBestM: null };

const rows: MarkRow[] = [
  { day: '2025-08-10', kind: 'competition', markM: 1.9 },
  { day: '2026-03-15', kind: 'competition', markM: 1.8 },
  { day: '2026-05-20', kind: 'competition', markM: 1.75 },
  { day: '2026-06-01', kind: 'practice', markM: 1.95 },
];

describe('computeBests', () => {
  it('記録が無ければすべて空', () => {
    expect(computeBests([], none, '2026-10-11', 1)).toEqual({
      pbM: null,
      sbM: null,
      practiceBestM: null,
    });
  });

  // 練習で跳んだ 1.95 は PB にも SB にも入らない
  it('PB と SB は試合の記録だけ、練習は練習ベスト', () => {
    expect(computeBests(rows, none, '2026-10-11', 1)).toEqual({
      pbM: 1.9,
      sbM: 1.8,
      practiceBestM: 1.95,
    });
  });

  // 3月の 1.80 は前のシーズン
  it('4月始まりなら SB は4月以降の試合だけ', () => {
    expect(computeBests(rows, none, '2026-10-11', 4).sbM).toBe(1.75);
  });

  it('手で入れた値が高ければそちら', () => {
    const manual = { pbM: 2.0, sbM: 1.85, sbSeason: 2026, practiceBestM: 1.9 };
    expect(computeBests(rows, manual, '2026-10-11', 1)).toEqual({
      pbM: 2.0,
      sbM: 1.85,
      practiceBestM: 1.95,
    });
  });

  // 走幅跳で追い風 2.1 m/s の 6.50 は公認されない。2.0 ちょうどと、風速の無い記録は数える
  it('追い風参考の試合の記録は PB と SB に数えない', () => {
    const jumps: MarkRow[] = [
      { day: '2026-06-01', kind: 'competition', markM: 6.5, windMs: 2.1 },
      { day: '2026-06-01', kind: 'competition', markM: 6.3, windMs: 2.0 },
      { day: '2026-06-02', kind: 'competition', markM: 6.1, windMs: null },
      { day: '2026-06-03', kind: 'practice', markM: 6.6, windMs: 3.0 },
    ];
    expect(computeBests(jumps, none, '2026-10-11', 1)).toEqual({
      pbM: 6.3,
      sbM: 6.3,
      practiceBestM: 6.6,
    });
  });

  it('手で入れた SB は、シーズンが変わったら数えない', () => {
    const manual = { ...none, sbM: 2.1, sbSeason: 2025 };
    expect(computeBests(rows, manual, '2026-10-11', 1).sbM).toBe(1.8);
  });
});
