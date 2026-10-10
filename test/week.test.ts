import { describe, expect, it } from 'vitest';
import { weekStartFor } from '@/lib/week';

describe('weekStartFor', () => {
  it('ブラウザの地域の週の始まりに従う', () => {
    expect(weekStartFor('ja-JP', 'Asia/Tokyo')).toBe(0);
    expect(weekStartFor('en-US', 'America/New_York')).toBe(0);
    expect(weekStartFor('en-GB', 'Europe/London')).toBe(1);
    expect(weekStartFor('de-DE', 'Europe/Berlin')).toBe(1);
  });

  it('土曜始まりの地域は日曜に寄せる', () => {
    expect(weekStartFor('ar-EG', 'Africa/Cairo')).toBe(0);
  });

  it('言語に地域が付いていなければ時間帯で推す', () => {
    expect(weekStartFor('en', 'Europe/London')).toBe(1);
    expect(weekStartFor('en', 'America/New_York')).toBe(0);
  });

  it('言語の名前が読めなければ時間帯で推す', () => {
    expect(weekStartFor('not a locale', 'Asia/Tokyo')).toBe(0);
    expect(weekStartFor('not a locale', 'America/Chicago')).toBe(0);
    expect(weekStartFor('not a locale', 'Europe/Paris')).toBe(1);
  });
});
