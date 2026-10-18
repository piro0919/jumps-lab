import { describe, expect, it } from 'vitest';
import { injuryToAsk, type InjuryStatus } from '@/lib/injury';

const today = '2026-10-18';
const log = (day: string, injury: string | null, injuryStatus: InjuryStatus | null = null) => ({
  day,
  injury,
  injuryStatus,
});

describe('injuryToAsk', () => {
  it('今日を除く直近14日でいちばん新しい痛みのメモを返す', () => {
    expect(
      injuryToAsk(
        [
          log('2026-10-04', '右膝'),
          log('2026-10-10', ' 内転筋が少し痛い '),
          log('2026-10-12', ' '),
        ],
        today,
      ),
    ).toEqual({ day: '2026-10-10', injury: '内転筋が少し痛い' });
  });

  it('14日より前のメモ、今日メモがある日、メモの後に治ったと答えた日は聞かない', () => {
    expect([
      injuryToAsk([log('2026-10-03', '右膝')], today),
      injuryToAsk([log('2026-10-10', '右膝'), log(today, '左足首')], today),
      injuryToAsk([log('2026-10-10', '右膝'), log('2026-10-12', null, 'healed')], today),
    ]).toEqual([null, null, null]);
  });

  it('治った以外の答えの後や、治ったと答えた後の新しいメモでは、また聞く', () => {
    expect([
      injuryToAsk([log('2026-10-10', '右膝'), log('2026-10-12', null, 'better')], today),
      injuryToAsk([log('2026-10-08', null, 'healed'), log('2026-10-10', '右膝')], today),
    ]).toEqual([
      { day: '2026-10-10', injury: '右膝' },
      { day: '2026-10-10', injury: '右膝' },
    ]);
  });
});
