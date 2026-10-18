'use client';

import { cn } from '@/lib/cn';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { Card, CardTitle, DisplayNumber, SectionTitle } from '@/components/layout-ui';
import { Button } from '@/components/ui/button';
import { WeatherPicture } from '@/components/weather-picture';
import { fetchWeather, type Weather, weatherKey, type WeatherKey } from '@/lib/weather';

/** 前に取った位置を使い回してよい時間（10分） */
const POSITION_MAX_AGE_MINUTES = 10;

type State =
  { kind: 'idle' } | { kind: 'loading' } | { kind: 'denied' } | { kind: 'ready'; weather: Weather };

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
      { maximumAge: POSITION_MAX_AGE_MINUTES * 60 * 1000 },
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
    return (
      <Card
        className={cn(
          'relative overflow-hidden bg-linear-to-r from-45% text-white',
          weather.isDay ? SKIES[key] : NIGHT_SKY,
        )}
      >
        <WeatherPicture
          weather={weather}
          className="pointer-events-none absolute -top-8 -right-8 size-44 select-none"
        />
        <div className="relative flex flex-col gap-4">
          <SectionTitle inverse>{t('weather')}</SectionTitle>
          <div className="flex flex-col gap-1">
            <DisplayNumber size="hero">{Math.round(weather.temperatureC)}°</DisplayNumber>
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
