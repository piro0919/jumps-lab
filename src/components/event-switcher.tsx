'use client';

import { useTranslations } from 'next-intl';
import { useTransition } from 'react';
import { setCurrentEventAction } from '@/app/actions/profile';
import type { JumpEvent } from '@/lib/events';

/** 見ている種目の切り替え。選んだ種目が1つなら名前だけを出す */
export function EventSwitcher({ events, current }: { events: JumpEvent[]; current: JumpEvent }) {
  const t = useTranslations('events');
  const [pending, startTransition] = useTransition();

  if (events.length === 1) {
    return <span className="text-sm font-semibold text-accent">{t(current)}</span>;
  }

  return (
    <select
      aria-label={t(current)}
      value={current}
      disabled={pending}
      onChange={(e) => startTransition(() => setCurrentEventAction(e.target.value))}
      className="h-9 rounded-full bg-accent-soft px-3.5 text-sm font-semibold text-accent outline-none disabled:opacity-60"
    >
      {events.map((event) => (
        <option key={event} value={event}>
          {t(event)}
        </option>
      ))}
    </select>
  );
}
