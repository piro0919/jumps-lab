'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { Card, CardTitle, SubtleButton } from '@/components/layout-ui';

type Weather = { temperature: number; code: number; windMs: number };

type State =
  { kind: 'idle' } | { kind: 'loading' } | { kind: 'denied' } | { kind: 'ready'; weather: Weather };

/** Open-Meteo の天気の番号を、文言の鍵へ */
function weatherKey(code: number) {
  if (code === 0) return 'clear';
  if (code <= 3) return 'cloudy';
  if (code <= 48) return 'fog';
  if (code <= 57) return 'drizzle';
  if (code <= 67) return 'rain';
  if (code <= 77) return 'snow';
  if (code <= 82) return 'showers';
  if (code <= 86) return 'snow';
  return 'thunder';
}

async function fetchWeather(latitude: number, longitude: number): Promise<Weather> {
  const url = new URL('https://api.open-meteo.com/v1/forecast');
  url.search = new URLSearchParams({
    latitude: latitude.toFixed(3),
    longitude: longitude.toFixed(3),
    current: 'temperature_2m,weather_code,wind_speed_10m',
    wind_speed_unit: 'ms',
  }).toString();
  const body = await (await fetch(url)).json();
  return {
    temperature: body.current.temperature_2m,
    code: body.current.weather_code,
    windMs: body.current.wind_speed_10m,
  };
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
        <div className="flex items-baseline justify-between">
          <span className="text-xl font-bold">
            {tWeather(weatherKey(state.weather.code))} {Math.round(state.weather.temperature)}°
          </span>
          <span className="text-sm text-muted-foreground tabular-nums">
            {t('wind', { speed: state.weather.windMs.toFixed(1) })}
          </span>
        </div>
      ) : state.kind === 'denied' ? (
        <p className="text-sm text-muted-foreground">{t('locationDenied')}</p>
      ) : (
        <SubtleButton type="button" onClick={load} disabled={state.kind === 'loading'}>
          {t('useLocation')}
        </SubtleButton>
      )}
    </Card>
  );
}
