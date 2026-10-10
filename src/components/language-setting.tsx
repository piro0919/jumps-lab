'use client';

import { Languages } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useTransition } from 'react';
import { cn } from 'cn';
import { setLocaleAction } from '@/app/actions/locale';
import { SEGMENTS, segmentClass } from '@/components/layout-ui';

/**
 * 設定の画面の言語の切り替え（自動・English・日本語）。言語の名前はその言語のまま出す（どの言語の画面でも探せるように）。
 * 選んだ時点で切り替わる。自動はブラウザの言語に従う。
 * 言語がブラウザの設定だけで決まり、自分で選べなかった（本人、2026-10-11）
 */
export function LanguageSetting({ current }: { current: 'auto' | 'en' | 'ja' }) {
  const t = useTranslations('nav');
  const [pending, startTransition] = useTransition();
  const options = [
    { value: 'auto', label: t('languageAuto') },
    { value: 'en', label: 'English' },
    { value: 'ja', label: '日本語' },
  ] as const;

  return (
    <div
      role="radiogroup"
      aria-label={t('language')}
      className={cn(SEGMENTS, 'grid w-full grid-cols-3')}
    >
      {options.map(({ value, label }, i) => (
        <button
          key={value}
          type="button"
          role="radio"
          aria-checked={current === value}
          disabled={pending}
          onClick={() => startTransition(() => setLocaleAction(value))}
          className={cn(segmentClass(current === value), 'gap-1.5 px-2')}
        >
          {i === 0 && <Languages aria-hidden className="size-4" />}
          {label}
        </button>
      ))}
    </div>
  );
}
