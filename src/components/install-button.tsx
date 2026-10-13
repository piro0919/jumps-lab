'use client';

import { Download } from 'lucide-react';
import dynamic from 'next/dynamic';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { createPortal } from 'react-dom';
import { usePwa } from 'use-pwa';
import { Button } from '@/components/ui/button';

const PWAPrompt = dynamic(() => import('react-ios-pwa-prompt'), { ssr: false });

/**
 * iPhone と iPad で、共有ボタンからホーム画面に追加する手順の案内（react-ios-pwa-prompt）。
 * ヘッダーの追加のボタンと、設定の通知のカード（iOS はホーム画面に置かないと通知を受け取れない）が使う
 */
export function InstallGuide({ shown, onClose }: { shown: boolean; onClose: () => void }) {
  const t = useTranslations('nav');
  return createPortal(
    <PWAPrompt
      isShown={shown}
      onClose={onClose}
      appIconPath="/apple-icon.png"
      copyTitle={t('install')}
      copyDescription={t('installDescription')}
      copyShareStep={t('installShareStep')}
      copyAddToHomeScreenStep={t('installAddStep')}
      delay={100}
    />,
    document.body,
  );
}

/**
 * ホーム画面に置くための入り口（鯉魂・spatto・vocafy と同じ use-pwa と react-ios-pwa-prompt）。
 * Chrome 系はブラウザの確認を出す。iOS / iPadOS は API が無いので、共有ボタンから追加する手順を案内する
 * （use-pwa の needsManualInstall。iPad の Safari が Mac を名乗るのも見分ける）。
 * 入れた後と、どちらもできない端末では何も出さない。一度押せば済む操作なので、アイコンだけにして場所を取らない
 */
export function InstallButton() {
  const t = useTranslations('nav');
  const { canInstall, install, isInstalled, needsManualInstall } = usePwa();
  const [guide, setGuide] = useState(false);

  if (isInstalled || (!canInstall && !needsManualInstall)) return null;

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
      {needsManualInstall ? <InstallGuide shown={guide} onClose={() => setGuide(false)} /> : null}
    </>
  );
}
