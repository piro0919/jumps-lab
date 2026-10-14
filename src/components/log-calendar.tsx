import { ChevronLeft, ChevronRight, Trophy } from 'lucide-react';
import Link from 'next/link';
import { getFormatter, getTranslations } from 'next-intl/server';
import { Card } from '@/components/layout-ui';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/cn';
import {
  ISO_DATE_START,
  ISO_DAY_END,
  ISO_MONTH_END,
  ISO_MONTH_START,
  ISO_YEAR_END,
} from '@/lib/dates';

const DAYS_PER_WEEK = 7;
/** 曜日の頭文字を出すための基準の週の日曜（2026-10-11）の日 */
const REFERENCE_SUNDAY = 11;

/** YYYY-MM の月を n か月ずらす */
function shiftMonth(month: string, n: number): string {
  const date = new Date(`${month}-01T00:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() + n);
  return date.toISOString().slice(0, ISO_MONTH_END);
}

/**
 * 記録をカレンダーの形で見る。記録か体調のある日に点を付け、押すとその日を開く（先の日は開かない）。
 * 大会の日（これからの大会も）にはトロフィーの印を付ける（2026-10-15）。
 * 週の頭と終わりの空きには、前の月と次の月の日を薄く出す（本人、2026-10-11）。押せば同じように開く。
 * 週は本人の設定の曜日から（日曜か月曜。はじめの値は登録したときのブラウザの地域、src/lib/week.ts）。
 * パソコンでは画面の幅いっぱいに広げ、マスを高くして日付を左上に置く（壁掛けのカレンダーの形）。
 * 最初は幅 448px に収めていて、小さいと言われた（本人、2026-10-11）
 */
export async function LogCalendar({
  month,
  today,
  recorded,
  competitions,
  weekStart,
}: {
  /** YYYY-MM */
  month: string;
  today: string;
  /** 記録か体調のある日 */
  recorded: Set<string>;
  /** 大会のある日 */
  competitions: Set<string>;
  /** 週の始まり。0 が日曜、1 が月曜 */
  weekStart: 0 | 1;
}) {
  const t = await getTranslations('log');
  const format = await getFormatter();
  const utc = (d: string) => new Date(`${d}T00:00:00Z`);

  const first = `${month}-01`;
  const daysInMonth = new Date(
    Date.UTC(
      Number(month.slice(0, ISO_YEAR_END)),
      Number(month.slice(ISO_MONTH_START, ISO_MONTH_END)),
      0,
    ),
  ).getUTCDate();
  // 月の1日より前に並べる前の月の日の数
  const leading = (utc(first).getUTCDay() - weekStart + DAYS_PER_WEEK) % DAYS_PER_WEEK;
  // 2026-10-11 は日曜、12 は月曜。曜日の頭文字を言語に合わせて出すための基準の週
  const weekdays = Array.from({ length: DAYS_PER_WEEK }, (_, i) =>
    format.dateTime(utc(`2026-10-${String(REFERENCE_SUNDAY + weekStart + i).padStart(2, '0')}`), {
      weekday: 'narrow',
      timeZone: 'UTC',
    }),
  );
  // 月の1日がある週の頭から、月の末日がある週の終わりまで
  const weeks = Math.ceil((leading + daysInMonth) / DAYS_PER_WEEK);
  const cells = Array.from({ length: weeks * DAYS_PER_WEEK }, (_, i) => {
    const date = utc(first);
    date.setUTCDate(1 - leading + i);
    const day = date.toISOString().slice(0, ISO_DAY_END);
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
              {Number(cell.slice(ISO_DATE_START))}
              <span className="flex h-3 items-center gap-1">
                {recorded.has(cell) && <span className="size-2 rounded-full bg-primary" />}
                {competitions.has(cell) && (
                  // role が無いと、押せない先の日のマスでは aria-label が読まれない
                  <Trophy
                    role="img"
                    aria-label={t('competitionDay')}
                    className="size-3 text-primary"
                  />
                )}
              </span>
            </>
          );
          const className = cn(
            'flex h-14 flex-col items-center justify-center gap-1.5 rounded-xl text-lg font-semibold tabular-nums lg:h-24 lg:items-start lg:justify-between lg:p-3',
            cell === today && 'font-bold text-primary',
            !inMonth && 'text-muted-foreground',
          );
          // 先の日は押せない。薄くしすぎると日付が読めないので（2.04 だった）、前後の月の日と同じ灰色に
          return cell > today ? (
            <span key={cell} className={cn(className, 'text-muted-foreground')}>
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
