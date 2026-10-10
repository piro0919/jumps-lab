'use client';

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
import { cn } from 'cn';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { Card, CardTitle, DisplayNumber, SectionTitle } from '@/components/layout-ui';
import { Button } from '@/components/ui/button';

type Weather = { temperature: number; code: number; windMs: number; isDay: boolean };

type State =
  { kind: 'idle' } | { kind: 'loading' } | { kind: 'denied' } | { kind: 'ready'; weather: Weather };

/**
 * Open-Meteo の天気の番号（WMO の28通り）を、9つにまとめた文言の鍵へ。
 * 番号の表は https://open-meteo.com/en/docs の WMO Weather interpretation codes
 */
function weatherKey(code: number) {
  if (code === 0) return 'clear';
  if (code <= 2) return 'partlyCloudy';
  if (code === 3) return 'cloudy';
  if (code <= 48) return 'fog';
  if (code <= 57) return 'drizzle';
  if (code <= 67) return 'rain';
  if (code <= 77) return 'snow';
  if (code <= 82) return 'showers';
  if (code <= 86) return 'snow';
  return 'thunder';
}

type WeatherKey = ReturnType<typeof weatherKey>;
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
 * カードの地に敷く空の色（iPhone の天気のウィジェットの形）。左から右へ明るくし、字を載せる左の45%は
 * 濃い色のまま塗って、白い字が 4.5 を割らないようにする（斜めにすると左下の風の字で割った）。夜はどの天気も紺
 */
const NIGHT_SKY = 'from-indigo-950 to-indigo-700';
const SKIES: Record<WeatherKey, string> = {
  clear: 'from-blue-600 to-sky-400',
  partlyCloudy: 'from-blue-700 to-slate-400',
  cloudy: 'from-slate-600 to-slate-400',
  fog: 'from-slate-600 to-zinc-400',
  drizzle: 'from-slate-700 to-blue-500',
  rain: 'from-slate-700 to-blue-500',
  snow: 'from-slate-600 to-sky-300',
  showers: 'from-slate-700 to-blue-500',
  thunder: 'from-slate-800 to-violet-700',
};

async function fetchWeather(latitude: number, longitude: number): Promise<Weather> {
  const url = new URL('https://api.open-meteo.com/v1/forecast');
  url.search = new URLSearchParams({
    latitude: latitude.toFixed(3),
    longitude: longitude.toFixed(3),
    current: 'temperature_2m,weather_code,wind_speed_10m,is_day',
    wind_speed_unit: 'ms',
  }).toString();
  const body = await (await fetch(url)).json();
  return {
    temperature: body.current.temperature_2m,
    code: body.current.weather_code,
    windMs: body.current.wind_speed_10m,
    isDay: body.current.is_day === 1,
  };
}

/**
 * 現在地の天気（Open-Meteo、鍵は要らない）。位置はブラウザから取り、サーバーには送らない。
 * 位置の許可が済んでいれば開いたときに出し、まだなら押してから聞く。
 * 天気が出たら、カードを空の色に塗り、天気の絵を右上に大きくはみ出させて置く
 */
export function WeatherCard() {
  const t = useTranslations('home');
  const tWeather = useTranslations('weather');
  const [state, setState] = useState<State>({ kind: 'idle' });

  const load = () => {
    setState({ kind: 'loading' });
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        try {
          setState({
            kind: 'ready',
            weather: await fetchWeather(coords.latitude, coords.longitude),
          });
        } catch {
          setState({ kind: 'idle' });
        }
      },
      () => setState({ kind: 'denied' }),
      { maximumAge: 10 * 60 * 1000 },
    );
  };

  // 開いたときに1回だけ、許可が済んでいるかを確かめる
  useEffect(() => {
    void navigator.permissions?.query({ name: 'geolocation' }).then((status) => {
      if (status.state === 'granted') load();
    });
  }, []);

  if (state.kind === 'ready') {
    const { weather } = state;
    const key = weatherKey(weather.code);
    const time: Time = weather.isDay ? 'day' : 'night';
    return (
      <Card
        className={cn(
          'relative overflow-hidden bg-linear-to-r from-45% text-white',
          time === 'day' ? SKIES[key] : NIGHT_SKY,
        )}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={pictureUrl(PICTURES[key][time])}
          alt=""
          aria-hidden
          className="pointer-events-none absolute -top-8 -right-8 size-44 select-none"
        />
        <div className="relative flex flex-col gap-4">
          <SectionTitle inverse>{t('weather')}</SectionTitle>
          <div className="flex flex-col gap-1">
            <DisplayNumber size="hero">{Math.round(weather.temperature)}°</DisplayNumber>
            <span className="text-base font-bold">{tWeather(key)}</span>
            <span className="text-sm tabular-nums">
              {t('wind', { speed: weather.windMs.toFixed(1) })}
            </span>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <CardTitle>{t('weather')}</CardTitle>
      {state.kind === 'denied' ? (
        <p className="text-sm text-muted-foreground">{t('locationDenied')}</p>
      ) : (
        <Button
          variant="secondary"
          size="sm"
          type="button"
          onClick={load}
          disabled={state.kind === 'loading'}
        >
          {t('useLocation')}
        </Button>
      )}
    </Card>
  );
}
