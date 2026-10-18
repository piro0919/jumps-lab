/** 位置を送る桁（小数3桁、約100m に丸める） */
const COORD_DIGITS = 3;

/** WMO の天気の番号で、まとまりごとの最後の番号（曇り・霧・霧雨・雨・雪・にわか雨・にわか雪） */
const WMO_LAST = {
  cloudy: 3,
  fog: 48,
  drizzle: 57,
  rain: 67,
  snow: 77,
  showers: 82,
  snowShowers: 86,
} as const;

/** 1周の度数 */
const FULL_TURN_DEG = 360;

/** 摂氏から華氏への換算（華氏 = 摂氏 × 1.8 + 32） */
const FAHRENHEIT_PER_CELSIUS = 1.8;
const FAHRENHEIT_AT_ZERO_C = 32;

/**
 * 天気。ホームの天気のカードと、その日のコンディションに残す天気（day_log の weather* 列、2026-10-18）。
 * 風向は風が吹いてくる方角の度（北が 0、東が 90）で、Open-Meteo の wind_direction_10m と同じ
 */
export type Weather = {
  code: number;
  temperatureC: number;
  windMs: number;
  windDeg: number;
  isDay: boolean;
};

/**
 * Open-Meteo の天気の番号（WMO の28通り）を、9つにまとめた文言の鍵へ。
 * 番号の表は https://open-meteo.com/en/docs の WMO Weather interpretation codes
 */
export function weatherKey(code: number) {
  if (code === 0) return 'clear';
  if (code <= 2) return 'partlyCloudy';
  if (code === WMO_LAST.cloudy) return 'cloudy';
  if (code <= WMO_LAST.fog) return 'fog';
  if (code <= WMO_LAST.drizzle) return 'drizzle';
  if (code <= WMO_LAST.rain) return 'rain';
  if (code <= WMO_LAST.snow) return 'snow';
  if (code <= WMO_LAST.showers) return 'showers';
  if (code <= WMO_LAST.snowShowers) return 'snow';
  return 'thunder';
}

export type WeatherKey = ReturnType<typeof weatherKey>;

/** 8方位（北から時計回り）。文言の鍵 */
const COMPASS_POINTS = ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw'] as const;
export type CompassPoint = (typeof COMPASS_POINTS)[number];

/** 風向の度を8方位へ。それぞれの方位の前後 22.5 度をその方位にする */
export function compassPoint(deg: number): CompassPoint {
  const step = FULL_TURN_DEG / COMPASS_POINTS.length;
  return COMPASS_POINTS[Math.round(deg / step) % COMPASS_POINTS.length]!;
}

/** 摂氏を華氏へ（ヤード・ポンドの人の表示） */
export function toFahrenheit(celsius: number): number {
  return celsius * FAHRENHEIT_PER_CELSIUS + FAHRENHEIT_AT_ZERO_C;
}

/**
 * 今いる場所の天気を Open-Meteo から取る（鍵は要らない）。ブラウザから直接呼び、位置は当方のサーバーに送らない。
 * 風向は 0〜360 で来るので、360 を 0 にそろえる（DB の check は 0〜359）
 */
export async function fetchWeather(latitude: number, longitude: number): Promise<Weather> {
  const url = new URL('https://api.open-meteo.com/v1/forecast');
  url.search = new URLSearchParams({
    latitude: latitude.toFixed(COORD_DIGITS),
    longitude: longitude.toFixed(COORD_DIGITS),
    current: 'temperature_2m,weather_code,wind_speed_10m,wind_direction_10m,is_day',
    wind_speed_unit: 'ms',
  }).toString();
  const body = await (await fetch(url)).json();
  return {
    code: body.current.weather_code,
    temperatureC: body.current.temperature_2m,
    windMs: body.current.wind_speed_10m,
    windDeg: Math.round(body.current.wind_direction_10m) % FULL_TURN_DEG,
    isDay: body.current.is_day === 1,
  };
}
