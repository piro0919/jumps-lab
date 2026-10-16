import { addDays, isTimeZone, todayIn } from '@/lib/dates';
import type { Locale } from '@/i18n/locales';
import type { PushSubscriptionJSON as PushTarget } from '@piro0919/next-push/server';

/**
 * 大会の前日の知らせ（通知）を、誰のどの大会に送るかを決める。DB も時計も読まない（test/push.test.ts）。
 *
 * Cron は UTC の 1 時・9 時・17 時の3回（vercel.json）。どの時間帯の人も、3回のうちちょうど1回だけ
 * 手元の時刻が 15:00〜22:59 に入る（8 時間おきの3回と、8 時間の窓）。その回に、手元の明日の大会を送る。
 * だから知らせは、その人の時間帯で前の日の夕方から夜に届く
 */

/** 送る窓の始まり（手元の 15 時）と終わり（23 時の手前まで） */
const REMINDER_FROM_HOUR = 15;
const REMINDER_UNTIL_HOUR = 23;

/**
 * どの時間帯でも「手元の明日」が入る UTC の日付の幅。いちばん東（UTC+14）の明日は UTC の今日から2日後、
 * いちばん西（UTC-12）の明日は UTC の今日
 */
const TOMORROW_RANGE_DAYS = 2;

/** DB から読む1行。宛先1つと、その人の大会1つの組み */
export type ReminderRow = {
  endpoint: string;
  p256dh: string;
  auth: string;
  locale: Locale;
  userId: string;
  timeZone: string;
  competitionId: string;
  name: string;
  /** 大会の日（YYYY-MM-DD） */
  day: string;
};

/** 送る知らせ1つ。大会1つにつき1つ、その人の全部の宛先へ */
export type Reminder = {
  /** 二度送らないための印（push_sent の key） */
  key: string;
  competitionId: string;
  name: string;
  targets: (PushTarget & { locale: Locale })[];
};

/** その時間帯の、手元の時（0〜23） */
function localHour(timeZone: string, now: Date): number {
  return Number(
    new Intl.DateTimeFormat('en-US', { timeZone, hour: 'numeric', hourCycle: 'h23' }).format(now),
  );
}

/** 手元の時刻が送る窓（15:00〜22:59）に入っているか */
export function inReminderWindow(timeZone: string, now: Date): boolean {
  const hour = localHour(timeZone, now);
  return hour >= REMINDER_FROM_HOUR && hour < REMINDER_UNTIL_HOUR;
}

/** 読む大会の日付の幅（UTC の今日から2日後まで）。この中から、人ごとの手元の明日のものだけを選ぶ */
export function candidateDays(now: Date): { from: string; to: string } {
  const from = todayIn('UTC', now);
  return { from, to: addDays(from, TOMORROW_RANGE_DAYS) };
}

/**
 * 今送る知らせ。手元が窓に入っている人の、手元の明日の大会だけ。
 * 印は大会と日付で作る（日付を変えた大会は、新しい日の前日にもう一度送る）
 */
export function pickReminders(rows: ReminderRow[], now: Date): Reminder[] {
  const reminders = new Map<string, Reminder>();
  for (const row of rows) {
    if (!isTimeZone(row.timeZone) || !inReminderWindow(row.timeZone, now)) continue;
    if (row.day !== addDays(todayIn(row.timeZone, now), 1)) continue;
    const key = `meet:${row.competitionId}:${row.day}`;
    const reminder = reminders.get(key) ?? {
      key,
      competitionId: row.competitionId,
      name: row.name,
      targets: [],
    };
    if (!reminder.targets.some((t) => t.endpoint === row.endpoint)) {
      reminder.targets.push({
        endpoint: row.endpoint,
        keys: { p256dh: row.p256dh, auth: row.auth },
        locale: row.locale,
      });
    }
    reminders.set(key, reminder);
  }
  return [...reminders.values()];
}
