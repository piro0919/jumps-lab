import { describe, expect, it } from 'vitest';
import {
  daysBetween,
  isDay,
  isMonth,
  isTimeZone,
  seasonOf,
  seasonStart,
  todayIn,
} from '@/lib/dates';

describe('todayIn', () => {
  // UTC の 2026-10-10 20:00 は、東京では翌日の朝5時
  const now = new Date('2026-10-10T20:00:00Z');

  it('本人の時間帯で日付を数える', () => {
    expect(todayIn('Asia/Tokyo', now)).toBe('2026-10-11');
    expect(todayIn('America/Los_Angeles', now)).toBe('2026-10-10');
    expect(todayIn('UTC', now)).toBe('2026-10-10');
  });
});

describe('isTimeZone', () => {
  it('IANA の名前だけを通す', () => {
    expect(isTimeZone('Asia/Tokyo')).toBe(true);
    expect(isTimeZone('Mars/Olympus')).toBe(false);
  });
});

describe('daysBetween', () => {
  it('日数の差', () => {
    expect(daysBetween('2026-10-11', '2026-10-11')).toBe(0);
    expect(daysBetween('2026-10-11', '2026-10-20')).toBe(9);
    expect(daysBetween('2026-12-31', '2027-01-01')).toBe(1);
  });
});

describe('seasonOf', () => {
  it('1月始まりなら暦の年', () => {
    expect(seasonOf('2026-01-01', 1)).toBe(2026);
    expect(seasonOf('2026-12-31', 1)).toBe(2026);
  });

  it('4月始まりなら3月までは前の年のシーズン', () => {
    expect(seasonOf('2026-03-31', 4)).toBe(2025);
    expect(seasonOf('2026-04-01', 4)).toBe(2026);
  });

  it('シーズンの初日', () => {
    expect(seasonStart(2025, 4)).toBe('2025-04-01');
  });
});

describe('isDay', () => {
  it('実在する日付だけを通す', () => {
    expect(isDay('2026-10-11')).toBe(true);
    expect(isDay('2024-02-29')).toBe(true);
    expect(isDay('2026-02-30')).toBe(false);
    expect(isDay('2026-13-01')).toBe(false);
    expect(isDay('2026-1-1')).toBe(false);
  });
});

describe('isMonth', () => {
  it('01〜12 の月だけを通す', () => {
    expect(isMonth('2026-10')).toBe(true);
    expect(isMonth('2026-13')).toBe(false);
    expect(isMonth('2026-00')).toBe(false);
  });
});
