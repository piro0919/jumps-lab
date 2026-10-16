import 'server-only';
import { isValidSubscription, sendPushBatch } from '@piro0919/next-push/server';
import { createTranslator } from 'next-intl';
import { env } from '@/env';
import type { Locale } from '@/i18n/locales';
import { commentNotice, type CommentNoticeInput } from '@/lib/comment-notice';
import {
  claimPushKeys,
  commentPushTargets,
  deletePushEndpoints,
  listReminderRows,
  releasePushKeys,
} from '@/lib/data';
import { candidateDays, pickReminders } from '@/lib/meet-reminder';
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

/**
 * 1つの知らせ（大会×言語）を送り終えるまでの上限。next-push の送信には時間切れが無く、
 * 通知サービスが1つ止まると後ろの知らせまで待たされて、関数ごと打ち切られる
 */
const SEND_TIMEOUT_MS = 20_000;

const MESSAGES = { en, ja } as const;

/** 1回の Cron の結果。数だけ（宛先や大会名は返さない） */
export type ReminderRun = { reminders: number; sent: number; gone: number; failed: number };

type Target = { endpoint: string; keys: { p256dh: string; auth: string } };
type Outcome = { sent: number; gone: string[]; failed: number };

const FAILED_ALL = (targets: Target[]): Outcome => ({ sent: 0, gone: [], failed: targets.length });

/**
 * 時間切れで打ち切る。打ち切った送信は届かなかったものとして数える。
 * 先に終わればタイマーを消す（残すと、関数がその分だけ生き続ける）
 */
async function withTimeout<T>(promise: Promise<T>, fallback: T): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((resolve) => {
        timer = setTimeout(() => resolve(fallback), SEND_TIMEOUT_MS);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * 1つの知らせを、その言語の宛先へまとめて送る。混雑や通信の失敗（retryable）だった宛先にだけ、すぐに一度送り直す。
 * 次の Cron は8時間後で、本人の夕方の窓を外れるので、ここで送り直さないと届かない
 */
async function deliver(
  targets: Target[],
  payload: Parameters<typeof sendPushBatch>[1],
  ttl: number = TTL_SECONDS,
): Promise<Outcome> {
  const options = {
    vapidKeys: {
      publicKey: env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? '',
      privateKey: env.VAPID_PRIVATE_KEY ?? '',
    },
    subject: env.VAPID_SUBJECT,
    ttl,
    urgency: 'normal' as const,
    concurrency: CONCURRENCY,
  };
  const first = await sendPushBatch(targets, payload, options);
  const retry = first.results
    .filter(({ result }) => !result.ok && !result.gone && result.retryable)
    .map(({ subscription }) => subscription);
  if (retry.length === 0) {
    return { sent: first.sent, gone: first.goneEndpoints, failed: first.failed };
  }
  const second = await sendPushBatch(retry, payload, options);
  return {
    sent: first.sent + second.sent,
    gone: [...first.goneEndpoints, ...second.goneEndpoints],
    failed: first.failed - retry.length + second.failed,
  };
}

/**
 * 大会の前日の知らせを送る（Cron が1回ごとに呼ぶ）。DB への問い合わせは、読む・印を付ける・無効な宛先を消す・
 * 送れなかった印を外すの4回まで。知らせどうしは並べて送り、1つが遅くても他を待たせない。
 * 文言はその宛先の言語で組み、大会名だけを載せる（記録・メモ・痛み・体調は載せない。ロック画面に出るため）
 */
export async function sendMeetReminders(now: Date): Promise<ReminderRun> {
  const run: ReminderRun = { reminders: 0, sent: 0, gone: 0, failed: 0 };
  const { from, to } = candidateDays(now);
  const reminders = pickReminders(await listReminderRows(from, to), now);
  if (reminders.length === 0) return run;

  const claimed = await claimPushKeys(reminders.map((r) => r.key));
  const jobs = reminders
    .filter((reminder) => claimed.has(reminder.key))
    .map(async (reminder) => {
      const outcomes = await Promise.all(
        (['en', 'ja'] as const satisfies Locale[]).map((locale) => {
          // 検査を入れる前の行や、DB に直に入った行も、通知サービス以外へは送らない
          const targets = reminder.targets
            .filter((t) => t.locale === locale && isValidSubscription(t))
            .map(({ endpoint, keys }) => ({ endpoint, keys }));
          if (targets.length === 0) return Promise.resolve({ sent: 0, gone: [], failed: 0 });
          const t = createTranslator({ locale, messages: MESSAGES[locale], namespace: 'push' });
          const payload = {
            title: t('meetTomorrowTitle'),
            body: reminder.name,
            url: '/competitions',
            tag: `meet-${reminder.competitionId}`,
          };
          return withTimeout(
            deliver(targets, payload).catch(() => FAILED_ALL(targets)),
            FAILED_ALL(targets),
          );
        }),
      );
      return { key: reminder.key, outcomes };
    });

  const results = await Promise.all(jobs);
  const gone: string[] = [];
  const unsent: string[] = [];
  for (const { key, outcomes } of results) {
    run.reminders += 1;
    const sent = outcomes.reduce((sum, o) => sum + o.sent, 0);
    const failed = outcomes.reduce((sum, o) => sum + o.failed, 0);
    run.sent += sent;
    run.failed += failed;
    for (const o of outcomes) gone.push(...o.gone);
    // 1台にも届かず失敗だけだった知らせは印を外す（Cron をもう一度呼べば送り直せる）
    if (sent === 0 && failed > 0) unsent.push(key);
  }
  run.gone = gone.length;
  await deletePushEndpoints(gone);
  await releasePushKeys(unsent);
  return run;
}

/**
 * コメントの知らせを通知サービスに預ける時間（24 時間、仮決め）。コメントは急がないが、端末が1日眠っていても
 * 起きたときに届くように。next-push の既定の 60 秒では、電源を切っていた端末にはまず届かない
 */
const COMMENT_TTL_HOURS = 24;
const COMMENT_TTL_SECONDS = COMMENT_TTL_HOURS * 60 * 60;

/**
 * コメントを書いたあとに、相手の端末へ知らせる（Server Action が after() で呼ぶ。返事を待たせない）。
 * そのチームのコーチ（書いた人を除く）へ、コーチが書いたときは選手へも。文言は宛先の言語で組み、
 * 本文は載せない（src/lib/comment-notice.ts）。鍵が無ければ何もしない。無効と返された宛先は消す
 */
export async function sendCommentPush(input: {
  teamId: string;
  athleteId: string;
  authorId: string;
  day: string;
}): Promise<{ sent: number; failed: number }> {
  if (!pushReady()) return { sent: 0, failed: 0 };
  const found = await commentPushTargets(input);
  if (!found || found.targets.length === 0) return { sent: 0, failed: 0 };
  const byCoach = input.authorId !== input.athleteId;
  // 宛先（選手かコーチか）と言語の組ごとに、1つの知らせを組んで送る
  const groups = ([false, true] as const).flatMap((toCoach) =>
    (['en', 'ja'] as const satisfies Locale[]).map((locale) => ({ toCoach, locale })),
  );
  const outcomes = await Promise.all(
    groups.map(({ toCoach, locale }) => {
      const targets = found.targets
        .filter((t) => t.toCoach === toCoach && t.locale === locale && isValidSubscription(t))
        .map(({ endpoint, keys }) => ({ endpoint, keys }));
      if (targets.length === 0) return Promise.resolve({ sent: 0, gone: [], failed: 0 });
      const notice: CommentNoticeInput = {
        toCoach,
        byCoach,
        athleteId: input.athleteId,
        athleteName: found.athleteName,
        teamId: input.teamId,
        teamName: found.teamName,
        day: input.day,
      };
      return withTimeout(
        deliver(targets, commentNotice(notice, locale), COMMENT_TTL_SECONDS).catch(() =>
          FAILED_ALL(targets),
        ),
        FAILED_ALL(targets),
      );
    }),
  );
  await deletePushEndpoints(outcomes.flatMap((o) => o.gone));
  return {
    sent: outcomes.reduce((sum, o) => sum + o.sent, 0),
    failed: outcomes.reduce((sum, o) => sum + o.failed, 0),
  };
}
