import { describe, expect, it } from 'vitest';
import { currentGrade, gradeFromNumber, gradeNumber, offsetFor } from '@/lib/grade';

describe('gradeNumber', () => {
  // 2009-05-14 生まれは 2016 年4月に小学校へ入り、2026 年度は高2（11）
  it('2026年10月に 2009-05-14 生まれは高2', () => {
    expect(gradeNumber('2009-05-14', '2026-10-11')).toBe(11);
  });

  // 早生まれ（1月〜4月1日）は前の年の生まれと同じ学年
  it('4月1日生まれは前の年の人と同じ学年、4月2日生まれは次の学年', () => {
    expect(gradeNumber('2010-04-01', '2026-10-11')).toBe(11);
    expect(gradeNumber('2010-04-02', '2026-10-11')).toBe(10);
  });

  // 学年は4月1日に上がる
  it('3月31日と4月1日で学年が変わる', () => {
    expect(gradeNumber('2009-05-14', '2027-03-31')).toBe(11);
    expect(gradeNumber('2009-05-14', '2027-04-01')).toBe(12);
  });
});

describe('gradeFromNumber', () => {
  it('中1 から大4、その上は一般、小学生は無い', () => {
    expect(gradeFromNumber(6)).toBeNull();
    expect(gradeFromNumber(7)).toBe('jh1');
    expect(gradeFromNumber(11)).toBe('hs2');
    expect(gradeFromNumber(16)).toBe('univ4');
    expect(gradeFromNumber(17)).toBe('adult');
    expect(gradeFromNumber(40)).toBe('adult');
  });
});

describe('currentGrade と offsetFor', () => {
  const today = '2026-10-11';

  it('生年月日が無ければ手で選んだ学年', () => {
    expect(currentGrade(null, 'Asia/Tokyo', 0, 'hs1', today)).toBe('hs1');
  });

  // 計算では高2 だが、留年で高1 の人
  it('ずれを足した学年が翌年度も続く', () => {
    const offset = offsetFor('2009-05-14', 'hs1', today);
    expect(offset).toBe(-1);
    expect(currentGrade('2009-05-14', 'Asia/Tokyo', offset, null, today)).toBe('hs1');
    expect(currentGrade('2009-05-14', 'Asia/Tokyo', offset, null, '2027-04-01')).toBe('hs2');
  });

  it('計算がすでに一般なら、一般を選んでもずれは 0', () => {
    expect(offsetFor('1990-01-01', 'adult', today)).toBe(0);
  });
});

describe('日本以外の人', () => {
  // 日本の数え方を当てはめない。生年月日があっても手で選んだ学年
  it('時間帯が日本でなければ、生年月日があっても計算しない', () => {
    expect(currentGrade('2009-05-14', 'America/New_York', 0, 'hs1', '2026-10-11')).toBe('hs1');
    expect(currentGrade('2009-05-14', 'Europe/London', 0, null, '2026-10-11')).toBeNull();
  });
});
