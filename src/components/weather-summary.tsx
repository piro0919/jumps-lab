import { useTranslations } from 'next-intl';
import { WeatherPicture } from '@/components/weather-picture';
import type { Units } from '@/lib/units';
import { compassPoint, toFahrenheit, type Weather, weatherKey } from '@/lib/weather';

/**
 * その日に残した天気の1かたまり（絵・天気と気温・風向と風速）。コンディションの入力の欄と、見るだけのカードで使う。
 * 気温は単位の設定に合わせて摂氏か華氏、風はアプリのほかの風と同じく m/s のまま
 */
export function WeatherSummary({ weather, units }: { weather: Weather; units: Units }) {
  const t = useTranslations('today');
  const tWeather = useTranslations('weather');
  const tCompass = useTranslations('compass');
  const fahrenheit = units === 'imperial';
  const temperature = Math.round(
    fahrenheit ? toFahrenheit(weather.temperatureC) : weather.temperatureC,
  );
  return (
    <div className="flex items-center gap-3">
      <WeatherPicture weather={weather} className="size-12 shrink-0" />
      <div className="flex flex-col text-sm">
        <span className="font-bold">
          {t('weatherLine', {
            weather: tWeather(weatherKey(weather.code)),
            temperature,
            unit: fahrenheit ? 'f' : 'c',
          })}
        </span>
        <span className="tabular-nums">
          {t('weatherWind', {
            direction: tCompass(compassPoint(weather.windDeg)),
            speed: weather.windMs.toFixed(1),
          })}
        </span>
      </div>
    </div>
  );
}
