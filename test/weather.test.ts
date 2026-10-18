import { afterEach, describe, expect, it, vi } from 'vitest';
import { compassPoint, fetchWeather, toFahrenheit } from '@/lib/weather';

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

describe('fetchWeather', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const reply = (status: number, current: Record<string, unknown>) =>
    vi.fn(async () => new Response(JSON.stringify({ current }), { status }));
  const full = {
    weather_code: 3,
    temperature_2m: 23.8,
    wind_speed_10m: 1.52,
    wind_direction_10m: 360,
    is_day: 1,
  };

  it('今の天気を読み、風向の 360 を 0 にそろえる', async () => {
    vi.stubGlobal('fetch', reply(200, full));
    expect(await fetchWeather(33.59, 130.4)).toEqual({
      code: 3,
      temperatureC: 23.8,
      windMs: 1.52,
      windDeg: 0,
      isDay: true,
    });
  });

  it('失敗の応答と、値が欠けた応答は投げる（欄に入れて保存ごと弾かれないように）', async () => {
    const results = [];
    for (const fetcher of [reply(503, full), reply(200, { ...full, temperature_2m: null })]) {
      vi.stubGlobal('fetch', fetcher);
      results.push(
        await fetchWeather(0, 0).then(
          () => 'ok',
          () => 'threw',
        ),
      );
    }
    expect(results).toEqual(['threw', 'threw']);
  });
});
