import { ChevronLeft, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { getFormatter, getTranslations } from 'next-intl/server';
import { Card } from '@/components/layout-ui';
import { buttonVariants } from '@/components/ui/button';

/** YYYY-MM の月を n か月ずらす */
function shiftMonth(month: string, n: number): string {
  const date = new Date(`${month}-01T00:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() + n);
  return date.toISOString().slice(0, 7);
}

/**
 * 記録をカレンダーの形で見る。記録か体調のある日に点を付け、押すとその日を開く（先の日は開かない）。
 * 週は日曜から（全員。国ごとの週の始まりはまだ合わせていない。CLAUDE.md）
 */
export async function LogCalendar({
  month,
  today,
  recorded,
}: {
  /** YYYY-MM */
  month: string;
  today: string;
  /** 記録か体調のある日 */
  recorded: Set<string>;
}) {
  const t = await getTranslations('log');
  const format = await getFormatter();
  const utc = (d: string) => new Date(`${d}T00:00:00Z`);

  const first = `${month}-01`;
  const daysInMonth = new Date(
    Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0),
  ).getUTCDate();
  const leading = utc(first).getUTCDay();
  // 2026-10-11 は日曜。曜日の頭文字を言語に合わせて出すための基準の週
  const weekdays = Array.from({ length: 7 }, (_, i) =>
    format.dateTime(utc(`2026-10-${String(11 + i).padStart(2, '0')}`), {
      weekday: 'narrow',
      timeZone: 'UTC',
    }),
  );
  const cells = [
    ...Array.from({ length: leading }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => `${month}-${String(i + 1).padStart(2, '0')}`),
  ];
  const monthLink = (m: string) => `/log?view=calendar&month=${m}`;

  return (
    <Card>
      <div className="mb-3 flex items-center justify-between">
        <Link
          href={monthLink(shiftMonth(month, -1))}
          aria-label={t('previousMonth')}
          className={buttonVariants({ variant: 'secondary', size: 'icon' })}
        >
          <ChevronLeft aria-hidden className="size-5" />
        </Link>
        <span className="text-[17px] font-bold">
          {format.dateTime(utc(first), { year: 'numeric', month: 'long', timeZone: 'UTC' })}
        </span>
        <Link
          href={monthLink(shiftMonth(month, 1))}
          aria-label={t('nextMonth')}
          className={buttonVariants({ variant: 'secondary', size: 'icon' })}
        >
          <ChevronRight aria-hidden className="size-5" />
        </Link>
      </div>
      <div className="grid grid-cols-7 text-center text-xs font-medium text-muted-foreground">
        {weekdays.map((weekday, i) => (
          <span key={i} className="py-1">
            {weekday}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {cells.map((cell, i) => {
          if (cell === null) return <span key={`blank-${i}`} />;
          const label = (
            <>
              {Number(cell.slice(8))}
              <span className="flex h-1.5">
                {recorded.has(cell) && <span className="size-1.5 rounded-full bg-primary" />}
              </span>
            </>
          );
          const className = `flex h-12 flex-col items-center justify-center gap-1 rounded-xl text-[15px] tabular-nums ${
            cell === today ? 'font-bold text-primary' : ''
          }`;
          return cell > today ? (
            <span key={cell} className={`${className} text-muted-foreground/50`}>
              {label}
            </span>
          ) : (
            <Link key={cell} href={`/log/${cell}`} className={`${className} hover:bg-accent`}>
              {label}
            </Link>
          );
        })}
      </div>
    </Card>
  );
}
