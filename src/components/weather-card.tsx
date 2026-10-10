'use client';

import {
  Cloud,
  CloudDrizzle,
  CloudFog,
  CloudLightning,
  CloudMoon,
  CloudMoonRain,
  CloudRain,
  CloudSnow,
  CloudSun,
  CloudSunRain,
  Moon,
  Sun,
  type LucideIcon,
} from 'lucide-react';
import { cn } from 'cn';
import { useTranslations } from 'next-intl';
import { useEffect, useState, type ReactNode } from 'react';
import { Card, CardTitle, DisplayNumber } from '@/components/layout-ui';
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

/** まとめた天気ごとの絵。晴れ・晴れ時々曇り・にわか雨は、夜なら太陽を月に替える */
const ICONS: Record<WeatherKey, { day: LucideIcon; night: LucideIcon }> = {
  clear: { day: Sun, night: Moon },
  partlyCloudy: { day: CloudSun, night: CloudMoon },
  cloudy: { day: Cloud, night: Cloud },
  fog: { day: CloudFog, night: CloudFog },
  drizzle: { day: CloudDrizzle, night: CloudDrizzle },
  rain: { day: CloudRain, night: CloudRain },
  snow: { day: CloudSnow, night: CloudSnow },
  showers: { day: CloudSunRain, night: CloudMoonRain },
  thunder: { day: CloudLightning, night: CloudLightning },
};

/**
 * 絵の色。線は白い地で 3:1 を超える濃さにし、中を薄い同じ色で塗る。
 * 晴れは橙、夜は藍、曇りと霧は灰、雨と雪は青、雷は紫
 */
const SUN = 'text-amber-600 fill-amber-200';
const NIGHT = 'text-indigo-500 fill-indigo-100';
const GREY = 'text-slate-500 fill-slate-100';
const WET = 'text-sky-600 fill-sky-100';
const COLORS: Record<WeatherKey, { day: string; night: string }> = {
  clear: { day: SUN, night: NIGHT },
  partlyCloudy: { day: SUN, night: NIGHT },
  cloudy: { day: GREY, night: GREY },
  fog: { day: GREY, night: GREY },
  drizzle: { day: WET, night: WET },
  rain: { day: WET, night: WET },
  snow: { day: WET, night: WET },
  showers: { day: WET, night: WET },
  thunder: { day: 'text-violet-600 fill-violet-100', night: 'text-violet-600 fill-violet-100' },
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

/** 左に天気の絵、右に気温と天気の名前、その下に風 */
function WeatherNow({
  weather,
  label,
  children,
}: {
  weather: Weather;
  label: string;
  children: ReactNode;
}) {
  const key = weatherKey(weather.code);
  const time = weather.isDay ? 'day' : 'night';
  const Icon = ICONS[key][time];
  return (
    <div className="flex items-center gap-4">
      <Icon aria-hidden className={cn('size-12 shrink-0', COLORS[key][time])} strokeWidth={1.75} />
      <div className="flex min-w-0 flex-col gap-1">
        <span className="flex flex-wrap items-baseline gap-x-2">
          <DisplayNumber size="md">{Math.round(weather.temperature)}°</DisplayNumber>
          <span className="text-base font-bold">{label}</span>
        </span>
        {children}
      </div>
    </div>
  );
}

/**
 * 現在地の天気（Open-Meteo、鍵は要らない）。位置はブラウザから取り、サーバーには送らない。
 * 位置の許可が済んでいれば開いたときに出し、まだなら押してから聞く
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

  return (
    <Card>
      <CardTitle>{t('weather')}</CardTitle>
      {state.kind === 'ready' ? (
        <WeatherNow weather={state.weather} label={tWeather(weatherKey(state.weather.code))}>
          <span className="text-sm text-muted-foreground tabular-nums">
            {t('wind', { speed: state.weather.windMs.toFixed(1) })}
          </span>
        </WeatherNow>
      ) : state.kind === 'denied' ? (
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
