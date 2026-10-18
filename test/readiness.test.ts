import { describe, expect, it } from 'vitest';
import { addDays } from '@/lib/dates';
import { ageOn, readiness, type ConditionLog } from '@/lib/readiness';

const today = '2026-10-11';
const log = (day: string, fields: Partial<ConditionLog> = {}): ConditionLog => ({
  day,
  condition: null,
  fatigue: null,
  sleepHours: null,
  injury: null,
  ...fields,
});
const base = { today, logs: [] as ConditionLog[], competitions: [], birthdate: null };

describe('readiness', () => {
  it('記録も大会も無ければ通常で、今日の体調を促す', () => {
    expect(readiness(base)).toEqual({
      level: 'normal',
      reasons: [],
      weeksToTarget: null,
      needsLog: true,
    });
  });

  it('痛みの記入があれば、ほかに何があっても患部を守るを優先する', () => {
    const r = readiness({
      ...base,
      logs: [log(today, { injury: '右膝', sleepHours: 5 })],
      competitions: [{ day: addDays(today, 1), isTarget: true }],
    });
    expect(r.level).toBe('protect');
    expect(r.reasons.map((x) => x.key)).toEqual(['injury', 'preMeet', 'shortNight']);
  });

  it('今日のケガの経過が治った以外なら患部を守る。治った・前の日の経過では守らない', () => {
    const level = (logs: ConditionLog[]) => readiness({ ...base, logs }).level;
    expect([
      level([log(today, { injuryStatus: 'better' })]),
      level([log(today, { injuryStatus: 'same' })]),
      level([log(today, { injuryStatus: 'worse' })]),
      level([log(today, { injuryStatus: 'healed' })]),
      level([log(addDays(today, -1), { injuryStatus: 'worse' })]),
    ]).toEqual(['protect', 'protect', 'protect', 'normal', 'normal']);
  });

  it('大会まで3日以内は試合前の軽め、4日先は通常', () => {
    expect(
      readiness({ ...base, competitions: [{ day: addDays(today, 3), isTarget: false }] }).level,
    ).toBe('preMeet');
    expect(
      readiness({ ...base, competitions: [{ day: addDays(today, 4), isTarget: false }] }).level,
    ).toBe('normal');
  });

  it('主目標の大会の2週間前から調整期。印の無い大会では調整期にしない', () => {
    const in14 = addDays(today, 14);
    expect(readiness({ ...base, competitions: [{ day: in14, isTarget: true }] }).level).toBe(
      'taper',
    );
    expect(readiness({ ...base, competitions: [{ day: in14, isTarget: false }] }).level).toBe(
      'normal',
    );
    expect(
      readiness({ ...base, competitions: [{ day: addDays(today, 15), isTarget: true }] }).level,
    ).toBe('normal');
  });

  it('主目標の大会まで8週以内なら週の数、それより先なら準備期（null）', () => {
    expect(
      readiness({ ...base, competitions: [{ day: addDays(today, 20), isTarget: true }] })
        .weeksToTarget,
    ).toBe(3);
    expect(
      readiness({ ...base, competitions: [{ day: addDays(today, 57), isTarget: true }] })
        .weeksToTarget,
    ).toBeNull();
  });

  it('昨夜の睡眠が6時間以下なら軽め、6.5時間なら1晩だけでは軽めにしない', () => {
    expect(readiness({ ...base, logs: [log(today, { sleepHours: 6 })] }).level).toBe('lighter');
    expect(readiness({ ...base, logs: [log(today, { sleepHours: 6.5 })] }).reasons).toEqual([]);
  });

  it('直近7晩の平均が下限未満なら軽め。下限は18歳未満8時間、18歳以上7時間', () => {
    const logs = [0, 1, 2].map((i) => log(addDays(today, -i), { sleepHours: 7.5 }));
    expect(readiness({ ...base, logs, birthdate: '2010-04-01' }).reasons).toEqual([
      { key: 'shortWeek', average: 7.5, target: 8 },
    ]);
    expect(readiness({ ...base, logs, birthdate: '2000-04-01' }).reasons).toEqual([]);
    // 2晩しか無ければ平均は出さない
    expect(readiness({ ...base, logs: logs.slice(0, 2) }).reasons).toEqual([]);
  });

  it('記録が少ない間は疲労8以上・体調3以下で軽め', () => {
    expect(readiness({ ...base, logs: [log(today, { fatigue: 8 })] }).reasons).toEqual([
      { key: 'fatigue', value: 8 },
    ]);
    expect(readiness({ ...base, logs: [log(today, { condition: 3 })] }).reasons).toEqual([
      { key: 'condition', value: 3 },
    ]);
  });

  it('記録が14日分たまったら、本人の平均より2以上悪いときだけ軽め', () => {
    const past = Array.from({ length: 14 }, (_, i) =>
      log(addDays(today, -(i + 1)), { fatigue: 8, condition: 4 }),
    );
    // ふだんから疲労8の人の8は軽めにしない。10なら軽め
    expect(readiness({ ...base, logs: [...past, log(today, { fatigue: 8 })] }).reasons).toEqual([]);
    expect(readiness({ ...base, logs: [...past, log(today, { fatigue: 10 })] }).reasons).toEqual([
      { key: 'fatigue', value: 10 },
    ]);
    // ふだん体調4の人の3は軽めにしない。2なら軽め
    expect(readiness({ ...base, logs: [...past, log(today, { condition: 3 })] }).reasons).toEqual(
      [],
    );
    expect(readiness({ ...base, logs: [...past, log(today, { condition: 2 })] }).reasons).toEqual([
      { key: 'condition', value: 2 },
    ]);
  });
});

describe('readiness の端の場合', () => {
  it('主目標の大会の当日は1週と出す', () => {
    expect(
      readiness({ ...base, competitions: [{ day: today, isTarget: true }] }).weeksToTarget,
    ).toBe(1);
  });

  it('練習メモだけの日は、体調を入れていない扱い', () => {
    expect(readiness({ ...base, logs: [log(today)] }).needsLog).toBe(true);
  });

  it('いつも疲労が高い人でも、疲労10なら軽め', () => {
    const past = Array.from({ length: 14 }, (_, i) =>
      log(addDays(today, -(i + 1)), { fatigue: 9 }),
    );
    expect(readiness({ ...base, logs: [...past, log(today, { fatigue: 10 })] }).level).toBe(
      'lighter',
    );
  });
});

describe('ageOn', () => {
  it('誕生日の前日まではひとつ下', () => {
    expect(ageOn('2008-10-12', '2026-10-11')).toBe(17);
    expect(ageOn('2008-10-11', '2026-10-11')).toBe(18);
  });
});
