'use client';

import { authClient } from '@/lib/auth-client';

/** 通知の片付けを待つ上限。電波が悪くてもログアウトを待たせない */
const PUSH_CLEANUP_TIMEOUT_MS = 3000;

/**
 * この端末の通知の宛先を外す。先にブラウザの購読を外す（端末の中で済むので確実に終わり、通知はここで止まる）。
 * 次にサーバーの行を消す。時間切れでログアウトが先に進むときは、その要求を取り消す
 * （ログアウトの後に届くと 401 で行が残る。残った行は、次に送ったとき通知サービスが無効と返して消える）。
 * Service Worker を新しく登録はしない（通知を入れていない端末では何もしない）
 */
async function dropPushSubscription(signal: AbortSignal): Promise<void> {
  if (!('serviceWorker' in navigator)) return;
  const registration = await navigator.serviceWorker.getRegistration('/');
  const subscription = await registration?.pushManager.getSubscription();
  if (!subscription) return;
  const { endpoint } = subscription;
  await subscription.unsubscribe();
  await fetch(`/api/push?endpoint=${encodeURIComponent(endpoint)}`, { method: 'DELETE', signal });
}

/**
 * ログアウト（設定のボタンと、自分のアイコンのメニュー）。共用の端末で、前の選手の大会の通知が
 * 次の人に届かないよう、先にこの端末の通知を外す。外せなくても、時間がかかってもログアウトは止めない
 */
export async function signOut(): Promise<void> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PUSH_CLEANUP_TIMEOUT_MS);
  await dropPushSubscription(controller.signal).catch(() => {});
  clearTimeout(timer);
  await authClient.signOut();
}
