import Link from 'next/link';
import { Stat } from '@/components/layout-ui';
import { eventSlug, type JumpEvent } from '@/lib/events';
import { formatMarkParts, type Units } from '@/lib/units';

/**
 * ホームの目標やベストの1つ。押すとその種目の目標とベストを直す画面（/targets/[event]）へ移り、押した欄に入る。
 * 入力は窓ではなく画面で行う（本人、2026-10-11「統一性がなくてわかりづらい」）。
 * 押せる範囲と、指を乗せたときの地は、数字の周りに 8px の余白を取る。外側は同じだけ縮めて、並びの位置は変えない
 */
export function MarkLink({
  event,
  field,
  label,
  shown,
  units,
  size = 'md',
  inverse = false,
}: {
  event: JumpEvent;
  field: 'seasonGoalM' | 'manualPbM' | 'manualSbM' | 'manualPracticeBestM';
  label: string;
  /** 記録から出した値と手で入れた値の高い方 */
  shown: number | null;
  units: Units;
  size?: 'giant' | 'hero' | 'md' | 'sm';
  /** 色付きの地の上（字を白に） */
  inverse?: boolean;
}) {
  return (
    <Link
      href={`/targets/${eventSlug(event)}?focus=${field}`}
      className={`-m-2 block w-[calc(100%+1rem)] rounded-xl p-2 ${inverse ? 'hover:bg-white/10' : 'hover:bg-accent/60'}`}
    >
      <Stat
        value={shown === null ? null : formatMarkParts(shown, units)}
        label={label}
        size={size}
        inverse={inverse}
      />
    </Link>
  );
}
