'use client';

import { useEffect } from 'react';
import { repairTimeZoneAction } from '@/app/actions/profile';

/**
 * 時間帯が UTC のまま保存された人を、開いたときに一度だけブラウザの時間帯へ直す。
 * 登録と設定の保存が時間帯をみな UTC で保存していた不具合の後始末（2026-10-11、本人と決めた）。
 * 保存された値が UTC のときだけ動くので、ほかの人は旅行先で開いても変わらない
 */
export function TimeZoneRepair({ saved }: { saved: string }) {
  useEffect(() => {
    if (saved !== 'UTC') return;
    const browser = Intl.DateTimeFormat().resolvedOptions().timeZone;
    // 失敗しても次に開いたときにまたやる。画面には何も出さない
    if (browser && browser !== 'UTC') repairTimeZoneAction(browser).catch(() => {});
  }, [saved]);
  return null;
}
