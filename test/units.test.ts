import { describe, expect, it } from 'vitest';
import {
  cmToFeetInches,
  feetInchesToCm,
  feetInchesToMeters,
  formatMark,
  kgToLb,
  lbToKg,
  metersToFeetInches,
} from '@/lib/units';

describe('metersToFeetInches', () => {
  it.each([
    // 走高跳の 1.85 m は 6' 0¾"（72.83 インチを ¼ で切り捨て）
    [1.85, { feet: 6, inches: 0.75 }],
    [2.0, { feet: 6, inches: 6.5 }],
    // 走幅跳の 8.95 m は 29' 4¼"
    [8.95, { feet: 29, inches: 4.25 }],
    // ちょうど 6 フィート
    [1.8288, { feet: 6, inches: 0 }],
  ])('%s m → %o', (meters, expected) => {
    expect(metersToFeetInches(meters)).toEqual(expected);
  });

  // 実際より良く見せないため、切り上げない
  it('4分の1インチは切り捨てる', () => {
    // 6 フィートちょうどから 6mm（¼ インチは 6.35mm）上でも、¼ には上げない
    expect(metersToFeetInches(1.8288 + 0.006).inches).toBe(0);
  });
});

describe('feetInchesToMeters', () => {
  it('0.1mm まで丸める', () => {
    expect(feetInchesToMeters({ feet: 6, inches: 1 })).toBe(1.8542);
    expect(feetInchesToMeters({ feet: 29, inches: 4.25 })).toBeCloseTo(8.9472, 3);
  });

  // フィート・インチで入れた記録は、表示に戻しても同じ値になる
  it.each([
    [6, 1],
    [6, 0.75],
    [5, 11.25],
    [24, 7.5],
    [29, 4.25],
  ])('%s ft %s in は入れたとおりに戻る', (feet, inches) => {
    expect(metersToFeetInches(feetInchesToMeters({ feet, inches }))).toEqual({ feet, inches });
  });
});

describe('formatMark', () => {
  it('metric は小数2桁のメートル', () => {
    expect(formatMark(1.8, 'metric')).toBe('1.80 m');
  });

  it('imperial はフィートとインチ、端数は分数', () => {
    expect(formatMark(1.85, 'imperial')).toBe(`6' 0¾"`);
    expect(formatMark(2.0, 'imperial')).toBe(`6' 6½"`);
    expect(formatMark(1.8288, 'imperial')).toBe(`6' 0"`);
  });

  it('1フィート未満はインチだけ', () => {
    expect(formatMark(0.05, 'imperial')).toBe(`1¾"`);
  });
});

describe('身長と体重', () => {
  it('cm とフィート・インチを行き来する', () => {
    expect(cmToFeetInches(175)).toEqual({ feet: 5, inches: 9 });
    expect(feetInchesToCm({ feet: 5, inches: 9 })).toBe(175.3);
  });

  it('kg とポンドを行き来する', () => {
    expect(kgToLb(65)).toBe(143);
    expect(lbToKg(143)).toBe(64.9);
  });
});

describe('metric の表示', () => {
  // フィート・インチで入れた 6' 1"（1.8542 m）は、メートルでは 1.85 m（切り上げない）
  it('センチで切り捨てる', () => {
    expect(formatMark(1.8542, 'metric')).toBe('1.85 m');
    expect(formatMark(1.8599, 'metric')).toBe('1.85 m');
    expect(formatMark(1.86, 'metric')).toBe('1.86 m');
  });
});
