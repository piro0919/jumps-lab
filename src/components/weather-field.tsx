'use client';

import { X } from 'lucide-react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { consentWeatherAction } from '@/app/actions/profile';
import { ErrorText, LABEL } from '@/components/layout-ui';
import { Button } from '@/components/ui/button';
import { WeatherSummary } from '@/components/weather-summary';
import type { WeatherAccess } from '@/lib/joint-use';
import { safely } from '@/lib/safe-action';
import type { Units } from '@/lib/units';
import { fetchWeather, type Weather } from '@/lib/weather';

/** 前に取った位置を使い回してよい時間（10分。ホームの天気のカードと同じ） */
const POSITION_MAX_AGE_MINUTES = 10;
/** 位置が取れるまで待つ時間（屋内で位置が決まらない端末で、ボタンが押せないまま止まらないように。仮決め） */
const POSITION_TIMEOUT_SECONDS = 15;

type Phase = 'idle' | 'loading' | 'denied' | 'failed';

/**
 * コンディションの「天気」（中元さんの弟さんの要望、2026-10-18）。今日なら、端末の位置で Open-Meteo から今の天気を取り、
 * 隠し欄 weather に入れて、コンディションと一緒に保存する。位置はブラウザから Open-Meteo へ直接送り、当方には送らない。
 * 位置の許可が済んでいれば開いたときに取り、まだなら押してから聞く。取った天気は × で外せる（外して保存すると消える）。
 * 共同利用の項目に天気を足す前の人（access が consent）には、先に同意を聞く（src/lib/joint-use.ts）。
 * 過ぎた日は取らない（今の天気が残ってしまう）が、残してある天気は出して外せる
 */
export function WeatherField({
  initial,
  access,
  units,
}: {
  initial: Weather | null;
  access: WeatherAccess;
  units: Units;
}) {
  const t = useTranslations('today');
  const tHome = useTranslations('home');
  const tErrors = useTranslations('errors');
  const locale = useLocale();
  const [weather, setWeather] = useState(initial);
  const [phase, setPhase] = useState<Phase>('idle');
  const [agreed, setAgreed] = useState(access === 'fetch');
  const [consentFailed, setConsentFailed] = useState(false);
  const consenting = useRef(false);
  // 開いたときの値で1回だけ決める（あとで外したり同意したりしても、勝手には取り直さない）
  const [autoLoad] = useState(!initial && access === 'fetch');

  const load = () => {
    setPhase('loading');
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        try {
          setWeather(await fetchWeather(coords.latitude, coords.longitude));
          setPhase('idle');
        } catch {
          setPhase('failed');
        }
      },
      // 許可しなかったときだけ「位置情報がオフ」。屋内で位置が決まらない・時間切れは、押し直せるように失敗として出す
      (error) => setPhase(error.code === error.PERMISSION_DENIED ? 'denied' : 'failed'),
      {
        maximumAge: POSITION_MAX_AGE_MINUTES * 60 * 1000,
        timeout: POSITION_TIMEOUT_SECONDS * 1000,
      },
    );
  };

  // 開いたときに1回だけ、まだ天気が無く、同意も位置の許可も済んでいれば取る
  useEffect(() => {
    if (!autoLoad) return;
    // geolocation の名前を受け付けないブラウザは投げる。そのときは押してから聞く
    navigator.permissions
      ?.query({ name: 'geolocation' })
      .then((status) => {
        if (status.state === 'granted') load();
      })
      .catch(() => {});
  }, [autoLoad]);

  const agree = async () => {
    if (consenting.current) return;
    consenting.current = true;
    setConsentFailed(false);
    const result = await safely(() => consentWeatherAction());
    consenting.current = false;
    if (!result?.ok) {
      setConsentFailed(true);
      return;
    }
    setAgreed(true);
    load();
  };

  if (!weather && access === 'none') return null;

  return (
    <div className="flex flex-col gap-1.5">
      <span className={LABEL}>{t('weather')}</span>
      <input type="hidden" name="weather" value={weather ? JSON.stringify(weather) : ''} />
      {weather ? (
        <div className="flex items-center justify-between gap-2">
          <WeatherSummary weather={weather} units={units} />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={t('removeWeather')}
            onClick={() => setWeather(null)}
          >
            <X aria-hidden className="size-4" />
          </Button>
        </div>
      ) : agreed ? (
        <div className="flex flex-col items-start gap-1.5">
          {phase === 'denied' ? (
            <p className="text-sm text-muted-foreground">{tHome('locationDenied')}</p>
          ) : (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={load}
              disabled={phase === 'loading'}
            >
              {t('useWeather')}
            </Button>
          )}
          <ErrorText>{phase === 'failed' ? t('weatherFailed') : null}</ErrorText>
        </div>
      ) : (
        // 共同利用の項目を足すことへの同意。法の求めで画面に説明を置く例外（AI コーチの同意の画面と同じ）
        <div className="flex flex-col items-start gap-3 rounded-2xl bg-muted p-4 text-sm">
          <p>
            {t.rich('weatherConsent', {
              privacy: (chunks) => (
                <Link href={locale === 'ja' ? '/privacy' : '/en/privacy'} className="underline">
                  {chunks}
                </Link>
              ),
            })}
          </p>
          <Button type="button" size="sm" onClick={agree}>
            {t('weatherAgree')}
          </Button>
          <ErrorText>{consentFailed ? tErrors('generic') : null}</ErrorText>
        </div>
      )}
    </div>
  );
}
