'use client';

import { ThemeProvider as NextThemesProvider } from 'next-themes';
import type { ReactNode } from 'react';

/**
 * 配色の切り替え（鯉魂と同じ next-themes）。選んだ配色を html の data-theme に書き、
 * ブラウザに覚えさせる。はじめは端末の設定に合わせる。切り替えた瞬間に色がふわっと
 * 動かないよう、切り替えの間だけ transition を止める
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  return (
    <NextThemesProvider
      attribute="data-theme"
      defaultTheme="system"
      enableSystem
      themes={['light', 'dark']}
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  );
}
