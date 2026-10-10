'use client';

import { useShowWindowSize } from 'use-show-window-size';

/**
 * 画面の幅と高さを隅に出す。開発中だけ（鯉魂・spatto と同じ）。
 * 375px や 1024px の境目を確かめるたびに開発者ツールを開かずに済むように。本番では出さない
 */
export function WindowSize() {
  useShowWindowSize({ disable: process.env.NODE_ENV === 'production', position: 'top-right' });
  return null;
}
