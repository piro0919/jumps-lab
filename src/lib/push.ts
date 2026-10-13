import 'server-only';
import { sendPushBatch } from '@piro0919/next-push/server';
import { createTranslator } from 'next-intl';
import { env } from '@/env';
import type { Locale } from '@/i18n/locales';
import { claimPushKeys, deletePushEndpoints, listReminderRows } from '@/lib/data';
import { candidateDays, pickReminders } from '@/lib/meet-reminder';
import { isValidSubscription } from '@/lib/push-endpoint';
import en from '../../messages/en.json';
import ja from '../../messages/ja.json';

/** 通知の公開鍵。鍵が3つ揃っていなければ null（設定に通知のカードを出さない） */
export function pushPublicKey(): string | null {
  return pushReady() ? (env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? null) : null;
}

/**
 * 通知（Web Push）を送る側。鍵が3つ揃っていなければ、設定に通知のカードを出さず、Cron も送らない
 */
export function pushReady(): boolean {
  return (
    env.NEXT_PUBLIC_VAPID_PUBLIC_KEY !== undefined &&
    env.VAPID_PRIVATE_KEY !== undefined &&
    env.VAPID_SUBJECT !== undefined
  );
}

/**
 * 通知サービスに預ける時間（12 時間）。端末が眠っていても、この間に起きれば届く。
 * next-push の既定は 60 秒で、前の日の夕方の知らせが朝に届かなくなる
 */
const TTL_HOURS = 12;
const TTL_SECONDS = TTL_HOURS * 60 * 60;

/** 一度に送る数 */
const CONCURRENCY = 10;

const MESSAGES = { en, ja } as const;

/** 1回の Cron の結果。数だけ（宛先や大会名は返さない） */
export type ReminderRun = { reminders: number; sent: number; gone: number; failed: number };

/**
 * 大会の前日の知らせを送る（Cron が1回ごとに呼ぶ）。DB への問い合わせは、読む・印を付ける・無効な宛先を消すの3回まで。
 * 文言はその宛先の言語で組み、大会名だけを載せる（記録・メモ・痛み・体調は載せない。ロック画面に出るため）
 */
export async function sendMeetReminders(now: Date): Promise<ReminderRun> {
  const run: ReminderRun = { reminders: 0, sent: 0, gone: 0, failed: 0 };
  const { from, to } = candidateDays(now);
  const reminders = pickReminders(await listReminderRows(from, to), now);
  if (reminders.length === 0) return run;

  const claimed = await claimPushKeys(reminders.map((r) => r.key));
  const gone: string[] = [];
  for (const reminder of reminders) {
    if (!claimed.has(reminder.key)) continue;
    run.reminders += 1;
    for (const locale of ['en', 'ja'] as const satisfies Locale[]) {
      // 検査を入れる前の行や、DB に直に入った行も、通知サービス以外へは送らない
      const targets = reminder.targets.filter((t) => t.locale === locale && isValidSubscription(t));
      if (targets.length === 0) continue;
      const t = createTranslator({ locale, messages: MESSAGES[locale], namespace: 'push' });
      const result = await sendPushBatch(
        targets.map(({ endpoint, keys }) => ({ endpoint, keys })),
        {
          title: t('meetTomorrowTitle'),
          body: reminder.name,
          url: '/competitions',
          tag: `meet-${reminder.competitionId}`,
        },
        {
          vapidKeys: {
            publicKey: env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? '',
            privateKey: env.VAPID_PRIVATE_KEY ?? '',
          },
          subject: env.VAPID_SUBJECT,
          ttl: TTL_SECONDS,
          urgency: 'normal',
          concurrency: CONCURRENCY,
        },
      );
      run.sent += result.sent;
      run.gone += result.gone;
      run.failed += result.failed;
      gone.push(...result.goneEndpoints);
    }
  }
  await deletePushEndpoints(gone);
  return run;
}
