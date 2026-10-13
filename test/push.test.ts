import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { localeOfRequest } from '@/i18n/locales';
import { isCronRequest } from '@/lib/cron-auth';
import {
  candidateDays,
  inReminderWindow,
  pickReminders,
  type ReminderRow,
} from '@/lib/meet-reminder';
import { isPushServiceEndpoint, isValidSubscription } from '@/lib/push-endpoint';

const env = vi.hoisted(() => ({ CRON_SECRET: 'secret' as string | undefined }));
vi.mock('@/env', () => ({ env }));

const push = vi.hoisted(() => ({
  pushReady: vi.fn(() => true),
  sendMeetReminders: vi.fn(async () => ({ reminders: 0, sent: 0, gone: 0, failed: 0 })),
}));
vi.mock('@/lib/push', () => push);

const session = vi.hoisted(() => ({ user: null as { id: string } | null }));
vi.mock('@/lib/auth', () => ({
  getAuth: () => ({
    api: { getSession: async () => (session.user ? { user: session.user } : null) },
  }),
}));

const data = vi.hoisted(() => ({
  savePushSubscription: vi.fn(async () => {}),
  deletePushSubscription: vi.fn(async () => {}),
}));
vi.mock('@/lib/data', () => data);

const { GET } = await import('@/app/api/cron/meet-reminder/route');
const { POST, DELETE } = await import('@/app/api/push/route');

const P256DH = 'B'.repeat(87);
const AUTH = 'a'.repeat(22);
const FCM = 'https://fcm.googleapis.com/fcm/send/abc';

describe('通知の宛先', () => {
  it('ブラウザ各社の通知サービスだけを通す', () => {
    expect(isPushServiceEndpoint(FCM)).toBe(true);
    expect(isPushServiceEndpoint('https://updates.push.services.mozilla.com/wpush/v2/x')).toBe(
      true,
    );
    expect(isPushServiceEndpoint('https://web.push.apple.com/abc')).toBe(true);
    // Chromium 153 が返した宛先（2026-10-14）
    expect(isPushServiceEndpoint('https://jmt17.google.com/fcm/send/abc')).toBe(true);
    expect(isPushServiceEndpoint('https://jmt17.google.com.example.com/x')).toBe(false);
    expect(isPushServiceEndpoint('https://wns2-par02p.notify.windows.com/w/?token=x')).toBe(true);
  });

  it('ほかのホスト・http・ポート・似せた名前は通さない', () => {
    expect(isPushServiceEndpoint('https://example.com/push')).toBe(false);
    expect(isPushServiceEndpoint('http://fcm.googleapis.com/fcm/send/abc')).toBe(false);
    expect(isPushServiceEndpoint('https://fcm.googleapis.com:8443/fcm/send/abc')).toBe(false);
    expect(isPushServiceEndpoint('https://fcm.googleapis.com.evil.com/x')).toBe(false);
    expect(isPushServiceEndpoint('https://evilpush.apple.com.example/x')).toBe(false);
    expect(isPushServiceEndpoint('https://user@fcm.googleapis.com/x')).toBe(false);
    expect(isPushServiceEndpoint(`${FCM}/${'x'.repeat(1000)}`)).toBe(false);
    expect(isPushServiceEndpoint('not a url')).toBe(false);
  });

  it('鍵の長さと文字を見る', () => {
    expect(isValidSubscription({ endpoint: FCM, keys: { p256dh: P256DH, auth: AUTH } })).toBe(true);
    expect(
      isValidSubscription({ endpoint: FCM, keys: { p256dh: P256DH, auth: `${AUTH}==` } }),
    ).toBe(true);
    expect(isValidSubscription({ endpoint: FCM, keys: { p256dh: 'short', auth: AUTH } })).toBe(
      false,
    );
    expect(
      isValidSubscription({ endpoint: FCM, keys: { p256dh: P256DH, auth: `${'a'.repeat(21)}+` } }),
    ).toBe(false);
    expect(isValidSubscription({ endpoint: FCM })).toBe(false);
    expect(isValidSubscription(null)).toBe(false);
  });
});

describe('大会の前日の知らせを送る相手', () => {
  const row = (over: Partial<ReminderRow>): ReminderRow => ({
    endpoint: FCM,
    p256dh: P256DH,
    auth: AUTH,
    locale: 'ja',
    userId: 'u1',
    timeZone: 'Asia/Tokyo',
    competitionId: 'c1',
    name: '県大会',
    day: '2026-10-15',
    ...over,
  });

  // Cron の3回（UTC の 1 時・9 時・17 時）
  const runs = (day: string) =>
    [1, 9, 17].map((hour) => new Date(`${day}T${String(hour).padStart(2, '0')}:00:00Z`));

  it('どの時間帯でも、1日3回のうちちょうど1回だけ窓（手元の 15:00〜22:59）に入る', () => {
    const zones = [
      'Pacific/Kiritimati',
      'Etc/GMT+12',
      'Asia/Tokyo',
      'Asia/Kolkata',
      'Asia/Kathmandu',
      'Europe/London',
      'America/New_York',
      'America/St_Johns',
      'America/Los_Angeles',
      'UTC',
    ];
    const hits = ['2026-10-14', '2026-01-15', '2026-07-01'].flatMap((day) =>
      zones.map((zone) => [
        `${zone} ${day}`,
        runs(day).filter((now) => inReminderWindow(zone, now)).length,
      ]),
    );
    expect(hits).toHaveLength(zones.length * 3);
    expect(hits.filter(([, count]) => count !== 1)).toEqual([]);
  });

  it('窓に入っている人の、手元の明日の大会だけを選ぶ', () => {
    // UTC 9 時は東京の 18 時。明日は 10-15
    const now = new Date('2026-10-14T09:00:00Z');
    const picked = pickReminders(
      [
        row({}),
        row({ competitionId: 'today', day: '2026-10-14' }),
        row({ competitionId: 'later', day: '2026-10-16' }),
        // ニューヨークは 5 時で窓の外
        row({
          userId: 'u2',
          endpoint: `${FCM}2`,
          timeZone: 'America/New_York',
          competitionId: 'c2',
        }),
        row({ userId: 'u3', endpoint: `${FCM}3`, timeZone: 'Not/AZone', competitionId: 'c3' }),
      ],
      now,
    );
    expect(picked.map((r) => r.key)).toEqual(['meet:c1:2026-10-15']);
  });

  it('同じ人の端末はまとめ、同じ宛先は1度だけ', () => {
    const now = new Date('2026-10-14T09:00:00Z');
    const picked = pickReminders(
      [row({}), row({ endpoint: `${FCM}2`, locale: 'en' }), row({})],
      now,
    );
    expect(picked).toHaveLength(1);
    expect(picked[0]?.targets.map((t) => [t.endpoint, t.locale])).toEqual([
      [FCM, 'ja'],
      [`${FCM}2`, 'en'],
    ]);
  });

  it('西の時間帯は UTC の日付をまたいでも手元の明日で選ぶ', () => {
    // UTC 10-15 の 1 時はニューヨーク（夏時間、UTC-4）の 10-14 の 21 時。明日は 10-15
    const now = new Date('2026-10-15T01:00:00Z');
    const picked = pickReminders([row({ timeZone: 'America/New_York', day: '2026-10-15' })], now);
    expect(picked.map((r) => r.key)).toEqual(['meet:c1:2026-10-15']);
  });

  it('読む大会の日付の幅は、どの時間帯の明日も含む', () => {
    const zones = ['Pacific/Kiritimati', 'Etc/GMT+12', 'Asia/Tokyo'];
    const outside = runs('2026-10-14').flatMap((now) => {
      const { from, to } = candidateDays(now);
      return zones
        .map((zone) => {
          const local = new Intl.DateTimeFormat('en-CA', { timeZone: zone }).format(now);
          const day = new Date(Date.parse(`${local}T00:00:00Z`) + 24 * 60 * 60 * 1000)
            .toISOString()
            .slice(0, 10);
          return { zone, now: now.toISOString(), day, inside: day >= from && day <= to };
        })
        .filter((result) => !result.inside);
    });
    expect(runs('2026-10-14').length).toBeGreaterThan(0);
    expect(outside).toEqual([]);
  });
});

describe('宛先に残す言語', () => {
  it('設定で選んだ言語、ブラウザの言語、英語の順', () => {
    expect(
      localeOfRequest(new Headers({ cookie: 'a=1; locale=ja', 'accept-language': 'en' })),
    ).toBe('ja');
    expect(localeOfRequest(new Headers({ 'accept-language': 'ja,en;q=0.5' }))).toBe('ja');
    expect(localeOfRequest(new Headers({ cookie: 'locale=fr' }))).toBe('en');
  });
});

describe('Cron の鍵', () => {
  it('Bearer と鍵がそのまま合うときだけ', () => {
    expect(isCronRequest('Bearer secret', 'secret')).toBe(true);
    expect(isCronRequest('Bearer wrong', 'secret')).toBe(false);
    expect(isCronRequest('secret', 'secret')).toBe(false);
    expect(isCronRequest(null, 'secret')).toBe(false);
    expect(isCronRequest('Bearer ', undefined)).toBe(false);
  });

  const call = (authorization?: string) =>
    GET(
      new Request('http://localhost/api/cron/meet-reminder', {
        headers: authorization ? { authorization } : {},
      }),
    );

  beforeEach(() => {
    env.CRON_SECRET = 'secret';
    push.pushReady.mockReturnValue(true);
    push.sendMeetReminders.mockClear();
  });

  it('鍵が無い・違う要求は 401 で、送らない', async () => {
    expect((await call()).status).toBe(401);
    expect((await call('Bearer wrong')).status).toBe(401);
    expect(push.sendMeetReminders).not.toHaveBeenCalled();
  });

  it('鍵が合えば送る', async () => {
    const response = await call('Bearer secret');
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(push.sendMeetReminders).toHaveBeenCalledOnce();
  });

  it('CRON_SECRET か通知の鍵が無ければ 503', async () => {
    env.CRON_SECRET = undefined;
    expect((await call('Bearer secret')).status).toBe(503);
    env.CRON_SECRET = 'secret';
    push.pushReady.mockReturnValue(false);
    expect((await call('Bearer secret')).status).toBe(503);
    expect(push.sendMeetReminders).not.toHaveBeenCalled();
  });
});

describe('通知の宛先の受け口', () => {
  const subscribe = (body: unknown, headers: Record<string, string> = {}) =>
    POST(
      new Request('http://localhost/api/push', {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...headers },
        body: JSON.stringify(body),
      }),
    );
  const valid = { endpoint: FCM, keys: { p256dh: P256DH, auth: AUTH } };

  beforeEach(() => {
    session.user = { id: 'u1' };
    push.pushReady.mockReturnValue(true);
    data.savePushSubscription.mockClear();
    data.deletePushSubscription.mockClear();
  });

  it('ログインしていなければ 401', async () => {
    session.user = null;
    expect((await subscribe(valid)).status).toBe(401);
    expect(
      (await DELETE(new Request(`http://localhost/api/push?endpoint=${encodeURIComponent(FCM)}`)))
        .status,
    ).toBe(401);
    expect(data.savePushSubscription).not.toHaveBeenCalled();
  });

  it('通知サービスでない宛先と、鍵の形が違うものは 400', async () => {
    expect((await subscribe({ ...valid, endpoint: 'https://example.com/x' })).status).toBe(400);
    expect((await subscribe({ ...valid, keys: { p256dh: 'x', auth: AUTH } })).status).toBe(400);
    expect(data.savePushSubscription).not.toHaveBeenCalled();
  });

  it('ログインしている人の宛先として、選んだ言語で残す。送られた userId は信じない', async () => {
    const response = await subscribe(valid, { cookie: 'locale=ja' });
    expect(response.status).toBe(201);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(data.savePushSubscription).toHaveBeenCalledWith(
      'u1',
      expect.objectContaining(valid),
      'ja',
    );
    expect((await subscribe({ ...valid, userId: 'u2' })).status).toBe(403);
  });

  it('外すのは本人の宛先だけ', async () => {
    const response = await DELETE(
      new Request(`http://localhost/api/push?endpoint=${encodeURIComponent(FCM)}`, {
        method: 'DELETE',
      }),
    );
    expect(response.status).toBe(204);
    expect(data.deletePushSubscription).toHaveBeenCalledWith('u1', FCM);
  });
});

describe('public/sw.js', () => {
  const source = readFileSync('public/sw.js', 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');

  it('fetch を受けず、何も控えない（本人の記録を端末に残さない）', () => {
    expect(source).not.toMatch(/addEventListener\(\s*['"]fetch['"]/);
    expect(source).not.toMatch(/\bcaches\b|respondWith/);
  });

  it('通知の3つの出来事を受ける', () => {
    for (const name of ['push', 'notificationclick', 'pushsubscriptionchange']) {
      expect(source).toMatch(new RegExp(`addEventListener\\(\\s*['"]${name}['"]`));
    }
  });
});
