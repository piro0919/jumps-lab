import { describe, expect, it } from 'vitest';
import { compassPoint, toFahrenheit } from '@/lib/weather';

describe('compassPoint', () => {
  it('風向の度を8方位にし、方位の前後 22.5 度をその方位にする', () => {
    expect([0, 22, 23, 90, 180, 247, 315, 337, 338, 359].map(compassPoint)).toEqual([
      'n',
      'n',
      'ne',
      'e',
      's',
      'sw',
      'nw',
      'nw',
      'n',
      'n',
    ]);
  });
});

describe('toFahrenheit', () => {
  it('摂氏を華氏にする', () => {
    expect([-40, 0, 20, 37].map(toFahrenheit)).toEqual([-40, 32, 68, 98.60000000000001]);
  });
});
