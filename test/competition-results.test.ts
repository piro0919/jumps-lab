import { describe, expect, it } from 'vitest';
import { competitionResults } from '@/lib/competition-results';

describe('competitionResults', () => {
  it('大会として入れた記録だけを、日と種目ごとの最高にまとめる', () => {
    const results = competitionResults([
      { day: '2026-10-20', event: 'long_jump', kind: 'competition', markM: 6.1, windMs: 1.0 },
      { day: '2026-10-20', event: 'long_jump', kind: 'competition', markM: 6.3, windMs: 0.5 },
      { day: '2026-10-20', event: 'high_jump', kind: 'competition', markM: 1.8, windMs: null },
      { day: '2026-10-20', event: 'long_jump', kind: 'practice', markM: 7.0, windMs: null },
    ]);
    expect(results.get('2026-10-20')).toEqual([
      { event: 'long_jump', bestM: 6.3, windAided: false },
      { event: 'high_jump', bestM: 1.8, windAided: false },
    ]);
  });

  // 6.50 は追い風参考なので、公認の 6.20 を結果にする
  it('公認の記録があれば、追い風参考より優先する', () => {
    const results = competitionResults([
      { day: '2026-10-20', event: 'long_jump', kind: 'competition', markM: 6.5, windMs: 2.4 },
      { day: '2026-10-20', event: 'long_jump', kind: 'competition', markM: 6.2, windMs: 1.9 },
    ]);
    expect(results.get('2026-10-20')).toEqual([
      { event: 'long_jump', bestM: 6.2, windAided: false },
    ]);
  });

  it('追い風参考しか無ければ、その最高に印を付けて出す', () => {
    const results = competitionResults([
      { day: '2026-10-20', event: 'triple_jump', kind: 'competition', markM: 13.1, windMs: 2.2 },
      { day: '2026-10-20', event: 'triple_jump', kind: 'competition', markM: 13.4, windMs: 3.0 },
    ]);
    expect(results.get('2026-10-20')).toEqual([
      { event: 'triple_jump', bestM: 13.4, windAided: true },
    ]);
  });
});
