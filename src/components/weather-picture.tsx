import clearDay from '@meteocons/svg/fill/clear-day.svg';
import clearNight from '@meteocons/svg/fill/clear-night.svg';
import drizzle from '@meteocons/svg/fill/drizzle.svg';
import fogDay from '@meteocons/svg/fill/fog-day.svg';
import fogNight from '@meteocons/svg/fill/fog-night.svg';
import overcast from '@meteocons/svg/fill/overcast.svg';
import partlyCloudyDay from '@meteocons/svg/fill/partly-cloudy-day.svg';
import partlyCloudyDayRain from '@meteocons/svg/fill/partly-cloudy-day-rain.svg';
import partlyCloudyNight from '@meteocons/svg/fill/partly-cloudy-night.svg';
import partlyCloudyNightRain from '@meteocons/svg/fill/partly-cloudy-night-rain.svg';
import rain from '@meteocons/svg/fill/rain.svg';
import snow from '@meteocons/svg/fill/snow.svg';
import thunderstormsDay from '@meteocons/svg/fill/thunderstorms-day.svg';
import thunderstormsNight from '@meteocons/svg/fill/thunderstorms-night.svg';
import { cn } from '@/lib/cn';
import { type Weather, weatherKey, type WeatherKey } from '@/lib/weather';

type Time = 'day' | 'night';

/**
 * まとめた天気ごとの絵（Meteocons の fill、MIT。動く SVG で、img で出しても動く）。
 * 晴れ・晴れ時々曇り・霧・にわか雨・雷雨は、夜なら太陽を月に替える
 */
const PICTURES: Record<WeatherKey, Record<Time, unknown>> = {
  clear: { day: clearDay, night: clearNight },
  partlyCloudy: { day: partlyCloudyDay, night: partlyCloudyNight },
  cloudy: { day: overcast, night: overcast },
  fog: { day: fogDay, night: fogNight },
  drizzle: { day: drizzle, night: drizzle },
  rain: { day: rain, night: rain },
  snow: { day: snow, night: snow },
  showers: { day: partlyCloudyDayRain, night: partlyCloudyNightRain },
  thunder: { day: thunderstormsDay, night: thunderstormsNight },
};

/**
 * 取り込んだ SVG の URL。型は { src } だが、node_modules の SVG は開発サーバーでは文字列の URL で来た
 * （2026-10-11 に実測。.src だけを読むと絵が出なかった）ので、どちらでも読む
 */
function pictureUrl(picture: unknown): string {
  return typeof picture === 'string' ? picture : (picture as { src: string }).src;
}

/**
 * 天気の絵。ホームの天気のカードと、コンディションの天気（入力の欄と見るだけのカード）で使う。
 * 字で天気を書いた隣に置く飾りなので、読み上げには出さない
 */
export function WeatherPicture({ weather, className }: { weather: Weather; className?: string }) {
  const time: Time = weather.isDay ? 'day' : 'night';
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={pictureUrl(PICTURES[weatherKey(weather.code)][time])}
      alt=""
      aria-hidden
      className={cn('select-none', className)}
    />
  );
}
