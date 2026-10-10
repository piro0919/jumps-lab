'use client';

import { Download } from 'lucide-react';
import dynamic from 'next/dynamic';
import { useTranslations } from 'next-intl';
import { useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { usePwa } from 'use-pwa';
import { Button } from '@/components/ui/button';

const PWAPrompt = dynamic(() => import('react-ios-pwa-prompt'), { ssr: false });

/** iOS / iPadOS か。iPad の Safari は Mac を名乗るので、触れる Mac は iPad とみなす */
function isAppleDevice(): boolean {
  const agent = window.navigator.userAgent.toLowerCase();
  return (
    /iphone|ipad|ipod/.test(agent) ||
    (agent.includes('macintosh') && window.navigator.maxTouchPoints > 1)
  );
}

/**
 * ホーム画面に置くための入り口（鯉魂・spatto・vocafy と同じ use-pwa と react-ios-pwa-prompt）。
 * Chrome 系はブラウザの確認を出す。iOS は API が無いので、共有ボタンから追加する手順を案内する。
 * 入れた後と、どちらもできない端末では何も出さない。一度押せば済む操作なので、アイコンだけにして場所を取らない
 */
export function InstallButton() {
  const t = useTranslations('nav');
  const { canInstall, install, isInstalled } = usePwa();
  const [guide, setGuide] = useState(false);
  // 端末の判定は window を見る。サーバー側では決まらないので、載ってから読む
  const isApple = useSyncExternalStore(
    () => () => {},
    isAppleDevice,
    () => false,
  );

  if (isInstalled || (!canInstall && !isApple)) return null;

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        type="button"
        onClick={() => (canInstall ? void install() : setGuide(true))}
        aria-label={t('install')}
        title={t('install')}
      >
        <Download aria-hidden />
      </Button>
      {isApple && !canInstall
        ? createPortal(
            <PWAPrompt
              isShown={guide}
              onClose={() => setGuide(false)}
              appIconPath="/apple-icon.png"
              copyTitle={t('install')}
              copyDescription={t('installDescription')}
              copyShareStep={t('installShareStep')}
              copyAddToHomeScreenStep={t('installAddStep')}
              delay={100}
            />,
            document.body,
          )
        : null}
    </>
  );
}
