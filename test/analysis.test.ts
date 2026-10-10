import { describe, expect, it } from 'vitest';
import { analyze } from '@/lib/analysis';
import type { MarkRow } from '@/lib/bests';

const row = (day: string, markM: number): MarkRow => ({ day, kind: 'practice', markM });

describe('analyze', () => {
  it('記録が無ければ平均は無い', () => {
    expect(analyze([])).toEqual({ total: 0, averageM: null, monthlyBest: [], recent: [] });
  });

  it('総数、平均、月別ベスト（新しい月から）', () => {
    const result = analyze([
      row('2026-09-01', 1.7),
      row('2026-09-20', 1.8),
      row('2026-10-05', 1.75),
    ]);
    expect(result.total).toBe(3);
    expect(result.averageM).toBe(1.75);
    expect(result.monthlyBest).toEqual([
      { month: '2026-10', bestM: 1.75 },
      { month: '2026-09', bestM: 1.8 },
    ]);
  });

  it('推移は直近10本', () => {
    const rows = Array.from({ length: 12 }, (_, i) =>
      row(`2026-10-${String(i + 1).padStart(2, '0')}`, 1.5 + i / 100),
    );
    const recent = analyze(rows).recent;
    expect(recent).toHaveLength(10);
    expect(recent[0]?.day).toBe('2026-10-03');
  });
});

describe('平均の丸め', () => {
  // 21' 0"（6.4008 m）1本の平均は 21' 0" のまま（センチで丸めると 20' 11¾" になる）
  it('0.1mm で丸める', () => {
    expect(analyze([row('2026-10-11', 6.4008)]).averageM).toBe(6.4008);
  });
});
