/**
 * 通知の宛先として受け付けるか（鯉魂の isValidSubscription・spatto の push-endpoint.ts と同じ考え）。
 *
 * 宛先（endpoint）はブラウザが返す URL だが、受け口には誰でも好きな値を POST できる。
 * どこでも受け付けると、返事をしないサーバーを並べて Cron の送信を塞がれ（送る側に時間切れが無い）、
 * この関数から任意のホストへ POST させられる。そこでブラウザ各社の通知サービスだけを通す：
 * Chrome 系（FCM）、Firefox（Mozilla）、Safari（Apple）、Edge（WNS）。
 * Chromium 153 は fcm.googleapis.com ではなく jmt17.google.com の宛先を返した（2026-10-14、手元の確かめで
 * 400 になって気づいた。鯉魂と spatto の一覧には無い）
 * 登録するときと、送る直前の両方で見る
 */
const PUSH_HOSTS = [
  /^fcm\.googleapis\.com$/,
  /^android\.googleapis\.com$/,
  /^jmt\d+\.google\.com$/,
  /^updates\.push\.services\.mozilla\.com$/,
  /^(?:[a-z0-9-]+\.)*push\.apple\.com$/,
  /^[a-z0-9-]+\.notify\.windows\.com$/,
];

/** URL の長さの上限。通知サービスの宛先は数百文字に収まる */
const MAX_ENDPOINT_LENGTH = 1000;

/** 鍵は base64url。p256dh は 65 バイト（87 文字）、auth は 16 バイト（22 文字） */
const B64URL = /^[A-Za-z0-9_-]+=*$/;
const P256DH_LENGTH = 87;
const AUTH_LENGTH = 22;

export type PushTarget = { endpoint: string; keys: { p256dh: string; auth: string } };

export function isPushServiceEndpoint(endpoint: string): boolean {
  if (endpoint.length > MAX_ENDPOINT_LENGTH) return false;
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    return false;
  }
  return (
    url.protocol === 'https:' &&
    url.port === '' &&
    url.username === '' &&
    url.password === '' &&
    PUSH_HOSTS.some((host) => host.test(url.hostname))
  );
}

const keyOf = (value: unknown, length: number) =>
  typeof value === 'string' && B64URL.test(value) && value.replace(/=+$/, '').length === length;

export function isValidSubscription(value: unknown): value is PushTarget {
  if (typeof value !== 'object' || value === null) return false;
  const { endpoint, keys } = value as { endpoint?: unknown; keys?: unknown };
  if (typeof endpoint !== 'string' || !isPushServiceEndpoint(endpoint)) return false;
  if (typeof keys !== 'object' || keys === null) return false;
  const { p256dh, auth } = keys as { p256dh?: unknown; auth?: unknown };
  return keyOf(p256dh, P256DH_LENGTH) && keyOf(auth, AUTH_LENGTH);
}
