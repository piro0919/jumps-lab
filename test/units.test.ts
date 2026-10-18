import { describe, expect, it } from 'vitest';
import {
  cmToMeters,
  meterCmToMeters,
  metersToMeterCm,
  metersToWholeCm,
  cmToFeetInches,
  cmToQuarterInches,
  feetInchesToCm,
  feetInchesToMeters,
  formatMark,
  formatMarkParts,
  formatShortLength,
  inchesToCm,
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

describe('短い長さ（踏切板からの距離・支柱の位置）', () => {
  it('インチは 0.1cm で持ち、4分の1インチ刻みの値はインチに戻る', () => {
    const quarters = [0.25, 4.75, 18, 31.5];
    expect(quarters.map((inches) => cmToQuarterInches(inchesToCm(inches)))).toEqual(quarters);
    expect(inchesToCm(18)).toBe(45.7);
  });

  it('metric は 1cm に丸め、imperial はいちばん近い4分の1インチで書く', () => {
    expect(formatShortLength(12.4, 'metric')).toBe('12 cm');
    expect(formatShortLength(12.6, 'metric')).toBe('13 cm');
    expect(formatShortLength(45.7, 'imperial')).toBe('18"');
    expect(formatShortLength(12, 'imperial')).toBe('4¾"');
  });

  it('ポールの長さは記録と同じ書き方（15 フィートは 15\' 0"）', () => {
    expect(formatMark(feetInchesToMeters({ feet: 15, inches: 0 }), 'imperial')).toBe(`15' 0"`);
    expect(formatMark(4.572, 'metric')).toBe('4.57 m');
  });
});

describe('formatMarkParts', () => {
  it('metric は数字と m に分ける', () => {
    expect(formatMarkParts(1.8542, 'metric')).toEqual({ value: '1.85', unit: 'm' });
  });

  it('imperial は記号ごと数字にする', () => {
    expect(formatMarkParts(1.8542, 'imperial')).toEqual({ value: `6' 1"`, unit: '' });
  });
});

describe('センチの入力（走高跳・棒高跳の cm、走幅跳・三段跳の m と cm）', () => {
  it('センチは切り捨て、0.1mm で持っている値も入れた値に戻る', () => {
    expect({
      whole: [metersToWholeCm(2.05), metersToWholeCm(2.0599), metersToWholeCm(1.0)],
      split: [metersToMeterCm(6.91), metersToMeterCm(14.0), metersToMeterCm(6.9159)],
      back: [cmToMeters(205), meterCmToMeters(6, 91), meterCmToMeters(14, 5)],
    }).toEqual({
      whole: [205, 205, 100],
      split: [
        { m: 6, cm: 91 },
        { m: 14, cm: 0 },
        { m: 6, cm: 91 },
      ],
      back: [2.05, 6.91, 14.05],
    });
  });
});
