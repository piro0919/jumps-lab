import { describe, expect, it } from 'vitest';
import { conditionFrom, hasCondition, weatherSchema } from '@/lib/condition-input';

const weather = { code: 61, temperatureC: 18.44, windMs: 2.36, windDeg: 45, isDay: false };

describe('weatherSchema', () => {
  it('隠し欄の JSON を読み、気温と風速を 0.1 に丸める。空は残さない', () => {
    expect([
      weatherSchema.parse(JSON.stringify(weather)),
      weatherSchema.parse(''),
      weatherSchema.parse(undefined),
    ]).toEqual([{ ...weather, temperatureC: 18.4, windMs: 2.4 }, null, null]);
  });

  it('範囲の外、欠けた項目、読めない文字列は弾く', () => {
    const bad = [
      { ...weather, code: 100 },
      { ...weather, temperatureC: 61 },
      { ...weather, windMs: -1 },
      { ...weather, windDeg: 360 },
      { ...weather, windDeg: 1.5 },
      { code: 0 },
    ].map((value) => JSON.stringify(value));
    expect([...bad, 'not json'].map((value) => weatherSchema.safeParse(value).success)).toEqual(
      Array(bad.length + 1).fill(false),
    );
  });
});

describe('conditionFrom', () => {
  it('コンディションと一緒に天気を読む。天気の欄が無ければ null', () => {
    const base = { condition: '6', fatigue: '4', sleepHours: '7', injury: '' };
    expect([
      conditionFrom({ ...base, weather: JSON.stringify(weather) }),
      conditionFrom(base),
    ]).toEqual([
      {
        condition: 6,
        fatigue: 4,
        sleepHours: 7,
        injury: null,
        weather: { ...weather, temperatureC: 18.4, windMs: 2.4 },
      },
      { condition: 6, fatigue: 4, sleepHours: 7, injury: null, weather: null },
    ]);
  });
});

describe('hasCondition', () => {
  it('ケガの経過だけの行は、コンディションを入れていない扱いにする', () => {
    const empty = { condition: null, fatigue: null, sleepHours: null, injury: null };
    expect([
      hasCondition(null),
      hasCondition(empty),
      hasCondition({ ...empty, sleepHours: 6 }),
      hasCondition({ ...empty, injury: '右膝' }),
    ]).toEqual([false, false, true, true]);
  });
});
