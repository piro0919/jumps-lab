import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  claimPushKeys,
  deletePushEndpoints,
  deletePushSubscription,
  listReminderRows,
  releasePushKeys,
  saveCompetition,
  savePushSubscription,
} from '@/lib/data';
import { addProfile, query } from './seed';

/**
 * 通知（Web Push）の表。宛先は端末ごと、知らせの印は大会の前日の知らせを二度送らないためのもの。
 * 印と Cron の読み出しは全員の行を触るので、テストごとに別の鍵・別の人で確かめる
 */

function target() {
  return {
    endpoint: `https://fcm.googleapis.com/fcm/send/${randomUUID()}`,
    keys: { p256dh: `p-${randomUUID()}`, auth: `a-${randomUUID()}` },
  };
}

async function endpointsOf(userId: string) {
  const rows = await query<{ endpoint: string }>(
    `select endpoint from push_subscription where "userId" = $1 order by endpoint`,
    [userId],
  );
  return rows.map((r) => r.endpoint);
}

const competition = {
  id: null,
  venue: null,
  callRoomPlace: null,
  callRoomTime: null,
  startTime: null,
  notes: null,
  isTarget: false,
  entryUrl: null,
};

describe('claimPushKeys', () => {
  it('初めて付けた印だけを返し、2回目は何も返さない', async () => {
    const [a, b] = [randomUUID(), randomUUID()];
    expect(await claimPushKeys([a, b])).toEqual(new Set([a, b]));
    expect(await claimPushKeys([a, b])).toEqual(new Set());
  });

  it('同時に付けても、同じ印はどちらか一方だけが取る', async () => {
    const key = randomUUID();
    const [x, y] = await Promise.all([claimPushKeys([key]), claimPushKeys([key])]);
    expect(x.size + y.size).toBe(1);
  });

  it('releasePushKeys で外した印は、もう一度付けられる', async () => {
    const [a, b] = [randomUUID(), randomUUID()];
    await claimPushKeys([a, b]);
    await releasePushKeys([a]);
    expect(await claimPushKeys([a, b])).toEqual(new Set([a]));
  });

  it('30日より古い印を、次に付けるときに消す', async () => {
    const [old, recent] = [randomUUID(), randomUUID()];
    await query(
      `insert into push_sent (key, "sentAt") values ($1, now() - interval '31 days'), ($2, now() - interval '29 days')`,
      [old, recent],
    );
    await claimPushKeys([randomUUID()]);
    const left = await query<{ key: string }>(`select key from push_sent where key = any($1)`, [
      [old, recent],
    ]);
    expect(left.map((r) => r.key)).toEqual([recent]);
  });

  it('空の配列では DB を読まずに空を返す', async () => {
    expect(await claimPushKeys([])).toEqual(new Set());
  });
});

describe('savePushSubscription と deletePushSubscription', () => {
  it('同じ宛先をほかの人が保存すると、持ち主と鍵と言語を今の人に置き換える', async () => {
    const [a, b] = await Promise.all([addProfile(), addProfile()]);
    const t = target();
    await savePushSubscription(a, t, 'en');
    const newKeys = { p256dh: 'p-new', auth: 'a-new' };
    await savePushSubscription(b, { ...t, keys: newKeys }, 'ja');

    const rows = await query(
      `select "userId", p256dh, auth, locale from push_subscription where endpoint = $1`,
      [t.endpoint],
    );
    expect(rows).toEqual([{ userId: b, ...newKeys, locale: 'ja' }]);
  });

  it('消すのは本人の宛先だけ（ほかの人の宛先を指定しても残る）', async () => {
    const [a, b] = await Promise.all([addProfile(), addProfile()]);
    const [ta, tb] = [target(), target()];
    await savePushSubscription(a, ta, 'en');
    await savePushSubscription(b, tb, 'en');

    await deletePushSubscription(a, tb.endpoint);
    expect(await endpointsOf(b)).toEqual([tb.endpoint]);
    await deletePushSubscription(a, ta.endpoint);
    expect(await endpointsOf(a)).toEqual([]);
  });
});

describe('deletePushEndpoints', () => {
  it('無効と返された宛先だけを、持ち主を問わず消す', async () => {
    const [a, b] = await Promise.all([addProfile(), addProfile()]);
    const [ta1, ta2, tb] = [target(), target(), target()];
    await savePushSubscription(a, ta1, 'en');
    await savePushSubscription(a, ta2, 'en');
    await savePushSubscription(b, tb, 'en');

    await deletePushEndpoints([ta1.endpoint, tb.endpoint]);
    expect(await endpointsOf(a)).toEqual([ta2.endpoint]);
    expect(await endpointsOf(b)).toEqual([]);
  });
});

describe('listReminderRows', () => {
  it('通知を入れた人の、期間の中の大会を宛先ごとに、時間帯と言語を付けて読む', async () => {
    const [subscribed, silent] = await Promise.all([
      addProfile({ timeZone: 'Europe/Paris' }),
      addProfile(),
    ]);
    const [phone, laptop] = [target(), target()];
    await savePushSubscription(subscribed, phone, 'ja');
    await savePushSubscription(subscribed, laptop, 'en');
    await saveCompetition(subscribed, { ...competition, name: 'in range', day: '2026-10-15' });
    await saveCompetition(subscribed, { ...competition, name: 'too late', day: '2026-10-18' });
    await saveCompetition(subscribed, { ...competition, name: 'too early', day: '2026-10-13' });
    // 通知を入れていない人の大会は読まない
    await saveCompetition(silent, { ...competition, name: 'no subscription', day: '2026-10-15' });

    const rows = (await listReminderRows('2026-10-14', '2026-10-16')).filter(
      (row) => row.userId === subscribed || row.userId === silent,
    );
    expect(
      rows.map(({ endpoint, locale, timeZone, name, day }) => ({
        endpoint,
        locale,
        timeZone,
        name,
        day,
      })),
    ).toEqual([
      {
        endpoint: phone.endpoint,
        locale: 'ja',
        timeZone: 'Europe/Paris',
        name: 'in range',
        day: '2026-10-15',
      },
      {
        endpoint: laptop.endpoint,
        locale: 'en',
        timeZone: 'Europe/Paris',
        name: 'in range',
        day: '2026-10-15',
      },
    ]);
    expect(rows[0]!.competitionId).toMatch(/^[0-9a-f-]{36}$/);
    expect(rows[0]!.p256dh).toBe(phone.keys.p256dh);
  });
});
