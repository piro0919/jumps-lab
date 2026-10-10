'use client';

import { Monitor, Moon, Sun } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useTheme } from 'next-themes';
import { useSyncExternalStore } from 'react';
import { cn } from '@/lib/cn';
import { SEGMENTS, segmentClass } from '@/components/layout-ui';

const OPTIONS = [
  { value: 'system', key: 'themeSystem', Icon: Monitor },
  { value: 'light', key: 'themeLight', Icon: Sun },
  { value: 'dark', key: 'themeDark', Icon: Moon },
] as const;

const noop = () => () => {};

/**
 * 設定の画面の配色の切り替え（端末に合わせる・ライト・ダーク。鯉魂と vocafy も設定の画面に置いている）。
 * 選んだ時点で切り替わり、このブラウザに残る（next-themes）。載るまではどれも選ばれていない形で出す
 */
export function ThemeSetting() {
  const t = useTranslations('nav');
  const { theme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );

  return (
    <div
      role="radiogroup"
      aria-label={t('theme')}
      className={cn(SEGMENTS, 'grid w-full grid-cols-3')}
    >
      {OPTIONS.map(({ value, key, Icon }) => {
        const on = mounted && theme === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => setTheme(value)}
            className={cn(segmentClass(on), 'gap-1.5 px-2')}
          >
            <Icon aria-hidden className="size-4" />
            {t(key)}
          </button>
        );
      })}
    </div>
  );
}
