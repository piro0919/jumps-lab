'use client';

import { usePush } from '@piro0919/next-push';
import { Download } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { usePwa } from 'use-pwa';
import { InstallGuide } from '@/components/install-button';
import { CardTitle, Card, ErrorText, LABEL, SEGMENTS, segmentClass } from '@/components/layout-ui';
import { Button } from '@/components/ui/button';
import type { Locale } from '@/i18n/locales';
import { cn } from '@/lib/cn';

/** 通知の Service Worker（public/sw.js）。登録するのはこのカードだけ */
const SW_PATH = '/sw.js';

const noop = () => () => {};

/**
 * 設定の通知のカード。いまは大会の前日の知らせ1つで、オン・オフの切り替えだけ（src/app/api/cron/meet-reminder）。
 * 宛先は端末ごと。オンは「この端末に宛先がある」かつ「通知を許可している」ときだけ。
 * 許可はオンを押したときにだけ尋ねる。iPhone と iPad はホーム画面に追加したアプリでないと受け取れないので、
 * 先に追加の手順を出す。通知を受け取れない、ブロックしている、のときは短い文で知らせる
 */
export function PushSetting({
  vapidPublicKey,
  locale,
}: {
  vapidPublicKey: string;
  locale: Locale;
}) {
  const t = useTranslations('push');
  const { needsManualInstall } = usePwa();
  const { isSupported, permission, subscription, subscribe, unsubscribe } = usePush({
    vapidPublicKey,
    swPath: SW_PATH,
  });
  // ブラウザの機能はサーバーでは分からないので、載るまでは切り替えを押せない形で出す
  const mounted = useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
  const sending = useRef(false);
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState<'on' | 'off' | null>(null);
  const on = subscription !== null && permission === 'granted';

  // 開いたときと言語を変えたときに、宛先を登録し直す。消えた行を戻し、知らせの言語を画面に合わせる。
  // オンにした直後は登録したばかりなので送らない
  const synced = useRef<string | null>(null);
  useEffect(() => {
    if (!on || !subscription || sending.current) return;
    const key = `${subscription.endpoint}|${locale}`;
    if (synced.current === key) return;
    synced.current = key;
    void fetch('/api/push', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(subscription),
    }).catch(() => {});
  }, [on, subscription, locale]);

  const choose = async (next: boolean) => {
    if (next === on || sending.current) return;
    sending.current = true;
    setPending(true);
    setFailed(null);
    try {
      if (next) {
        synced.current = `${(await subscribe()).endpoint}|${locale}`;
      } else if (subscription) {
        // 先にサーバーの行を消す。ブラウザの購読を先に外すと、行が消せなかったときにもう一度押す手段が無くなる
        const response = await fetch(
          `/api/push?endpoint=${encodeURIComponent(subscription.endpoint)}`,
          { method: 'DELETE' },
        );
        if (!response.ok) throw new Error(`push delete ${response.status}`);
        await unsubscribe();
      }
    } catch {
      // 許可を断られたときは、ブロックの文が代わりに出る
      if (!(next && Notification.permission === 'denied')) setFailed(next ? 'on' : 'off');
    } finally {
      sending.current = false;
      setPending(false);
    }
  };

  return (
    <Card>
      <CardTitle>{t('title')}</CardTitle>
      {mounted && needsManualInstall ? (
        <InstallFirst />
      ) : mounted && !isSupported ? (
        <p className="text-sm text-muted-foreground">{t('unsupported')}</p>
      ) : (
        <div className="flex flex-col gap-1.5">
          <span className={LABEL}>{t('meetTomorrow')}</span>
          <div
            role="radiogroup"
            aria-label={t('meetTomorrow')}
            className={cn(SEGMENTS, 'grid w-full grid-cols-2')}
          >
            {([false, true] as const).map((value) => (
              <button
                key={String(value)}
                type="button"
                role="radio"
                aria-checked={mounted && on === value}
                disabled={!mounted || pending || permission === 'denied'}
                onClick={() => void choose(value)}
                className={segmentClass(mounted && on === value)}
              >
                {t(value ? 'on' : 'off')}
              </button>
            ))}
          </div>
          {mounted && permission === 'denied' ? (
            <p className="text-sm text-muted-foreground">{t('denied')}</p>
          ) : null}
          <ErrorText>
            {failed === null ? null : t(failed === 'on' ? 'failedOn' : 'failedOff')}
          </ErrorText>
        </div>
      )}
    </Card>
  );
}

/** iPhone と iPad の、まだホーム画面に追加していないとき。追加の手順を開くボタンを添える */
function InstallFirst() {
  const t = useTranslations('push');
  const tNav = useTranslations('nav');
  const [guide, setGuide] = useState(false);
  return (
    <div className="flex flex-col items-start gap-3">
      <p className="text-sm text-muted-foreground">{t('installFirst')}</p>
      <Button variant="secondary" size="sm" type="button" onClick={() => setGuide(true)}>
        <Download aria-hidden />
        {tNav('install')}
      </Button>
      <InstallGuide shown={guide} onClose={() => setGuide(false)} />
    </div>
  );
}
