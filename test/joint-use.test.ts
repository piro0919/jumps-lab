import { describe, expect, it } from 'vitest';
import {
  JOINT_USE_VERSION,
  keepWeatherIfAllowed,
  weatherAccess,
  weatherAllowed,
} from '@/lib/joint-use';

const today = '2026-10-18';
const adult = {
  birthdate: '2000-05-01',
  ageDeclared16Plus: true,
  jointUseVersion: JOINT_USE_VERSION,
};
const weather = { code: 0, temperatureC: 18.4, windMs: 2.3, windDeg: 45, isDay: true };

describe('weatherAccess', () => {
  it('今日なら、同意した16歳以上の人は取れ、まだの人には同意を聞く', () => {
    expect([
      weatherAccess(adult, today, today),
      weatherAccess({ ...adult, jointUseVersion: null }, today, today),
      weatherAccess({ ...adult, jointUseVersion: 1 }, today, today),
    ]).toEqual(['fetch', 'consent', 'consent']);
  });

  it('過ぎた日、16歳未満、生年月日が無く16歳以上かをまだ答えていない人には欄を出さない', () => {
    expect([
      weatherAccess(adult, '2026-10-17', today),
      weatherAccess({ ...adult, birthdate: '2012-05-01' }, today, today),
      weatherAccess({ ...adult, birthdate: null, ageDeclared16Plus: false }, today, today),
      weatherAccess({ ...adult, birthdate: null, ageDeclared16Plus: null }, today, today),
    ]).toEqual(['none', 'none', 'none', 'none']);
  });

  it('生年月日が無くても16歳以上と答えた人は本人が同意できる', () => {
    expect(
      weatherAccess(
        { birthdate: null, ageDeclared16Plus: true, jointUseVersion: null },
        today,
        today,
      ),
    ).toBe('consent');
  });
});

describe('weatherAllowed と keepWeatherIfAllowed', () => {
  const on = { today, day: today };

  it('過ぎた日は新しい天気を書き込めない。送られてきたら残してある天気のまま、外したら消す', () => {
    const input = { condition: 7, weather };
    const stored = { ...weather, code: 3, temperatureC: 9.1 };
    const past = { today, day: '2026-10-10' };
    expect({
      noStored: keepWeatherIfAllowed(input, adult, past),
      keepsStored: keepWeatherIfAllowed(input, adult, { ...past, stored }),
      removed: keepWeatherIfAllowed({ condition: 7, weather: null }, adult, { ...past, stored }),
    }).toEqual({
      noStored: { condition: 7, weather: null },
      keepsStored: { condition: 7, weather: stored },
      removed: { condition: 7, weather: null },
    });
  });

  it('同意した16歳以上の人の天気だけ残し、ほかは天気だけを外す', () => {
    const input = { condition: 7, weather };
    expect({
      allowed: weatherAllowed(adult, today),
      kept: keepWeatherIfAllowed(input, adult, on),
      notAgreed: keepWeatherIfAllowed(input, { ...adult, jointUseVersion: null }, on),
      under16: keepWeatherIfAllowed(input, { ...adult, birthdate: '2012-05-01' }, on),
    }).toEqual({
      allowed: true,
      kept: input,
      notAgreed: { condition: 7, weather: null },
      under16: { condition: 7, weather: null },
    });
  });
});
