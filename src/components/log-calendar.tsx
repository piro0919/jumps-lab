import { ChevronLeft, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { getFormatter, getTranslations } from 'next-intl/server';
import { Card } from '@/components/layout-ui';
import { buttonVariants } from '@/components/ui/button';
import { cn } from 'cn';

/** YYYY-MM の月を n か月ずらす */
function shiftMonth(month: string, n: number): string {
  const date = new Date(`${month}-01T00:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() + n);
  return date.toISOString().slice(0, 7);
}

/**
 * 記録をカレンダーの形で見る。記録か体調のある日に点を付け、押すとその日を開く（先の日は開かない）。
 * 週の頭と終わりの空きには、前の月と次の月の日を薄く出す（本人、2026-10-11）。押せば同じように開く。
 * 週は日曜から（全員。国ごとの週の始まりはまだ合わせていない。CLAUDE.md）。
 * パソコンでは画面の幅いっぱいに広げ、マスを高くして日付を左上に置く（壁掛けのカレンダーの形）。
 * 最初は幅 448px に収めていて、小さいと言われた（本人、2026-10-11）
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
  // 月の1日がある週の日曜から、月の末日がある週の土曜まで
  const weeks = Math.ceil((leading + daysInMonth) / 7);
  const cells = Array.from({ length: weeks * 7 }, (_, i) => {
    const date = utc(first);
    date.setUTCDate(1 - leading + i);
    const day = date.toISOString().slice(0, 10);
    return { day, inMonth: day.startsWith(month) };
  });
  const monthLink = (m: string) => `/log?view=calendar&month=${m}`;

  return (
    <Card>
      <div className="mb-4 flex items-center justify-between">
        <Link
          href={monthLink(shiftMonth(month, -1))}
          aria-label={t('previousMonth')}
          className={buttonVariants({ variant: 'secondary', size: 'icon' })}
        >
          <ChevronLeft aria-hidden className="size-5" />
        </Link>
        <span className="text-lg font-extrabold">
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
      <div className="grid grid-cols-7 text-center text-xs font-semibold text-muted-foreground lg:text-left lg:text-sm">
        {weekdays.map((weekday, i) => (
          <span key={i} className="py-1 lg:px-3">
            {weekday}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map(({ day: cell, inMonth }) => {
          const label = (
            <>
              {Number(cell.slice(8))}
              <span className="flex h-2">
                {recorded.has(cell) && <span className="size-2 rounded-full bg-primary" />}
              </span>
            </>
          );
          const className = cn(
            'flex h-14 flex-col items-center justify-center gap-1.5 rounded-xl text-lg font-semibold tabular-nums lg:h-24 lg:items-start lg:justify-between lg:p-3',
            cell === today && 'font-bold text-primary',
            !inMonth && 'text-muted-foreground',
          );
          return cell > today ? (
            <span key={cell} className={cn(className, 'text-muted-foreground/50')}>
              {label}
            </span>
          ) : (
            <Link key={cell} href={`/log/${cell}`} className={cn(className, 'hover:bg-accent')}>
              {label}
            </Link>
          );
        })}
      </div>
    </Card>
  );
}
