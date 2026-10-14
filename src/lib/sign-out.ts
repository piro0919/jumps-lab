'use client';

import { authClient } from '@/lib/auth-client';

/** 通知の片付けを待つ上限。電波が悪くてもログアウトを待たせない */
const PUSH_CLEANUP_TIMEOUT_MS = 3000;

/** この端末のブラウザの購読を外し、外した宛先を返す。購読していなければ null */
async function unsubscribeBrowser(): Promise<string | null> {
  if (!('serviceWorker' in navigator)) return null;
  const registration = await navigator.serviceWorker.getRegistration('/');
  const subscription = await registration?.pushManager.getSubscription();
  if (!subscription) return null;
  const { endpoint } = subscription;
  await subscription.unsubscribe();
  return endpoint;
}

/**
 * この端末の通知の宛先を外す。先にブラウザの購読を外す（端末の中で済むので確実に終わり、通知はここで止まる）。
 * 次にサーバーの行を消す。時間切れでログアウトが先に進むときは、その要求を取り消す
 * （ログアウトの後に届くと 401 で行が残る。残った行は、次に送ったとき通知サービスが無効と返して消える）。
 * Service Worker を新しく登録はしない（通知を入れていない端末では何もしない）
 */
async function dropPushSubscription(signal: AbortSignal): Promise<void> {
  const endpoint = await unsubscribeBrowser();
  if (!endpoint) return;
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

/**
 * 自分のアカウントを消す（設定のアカウントの区画）。動画の R2 からの削除と表の行は、サーバーの側
 * （src/lib/auth.ts の deleteUser）が受け持つ。ログインから時間がたっていると断られる（stale）ので、
 * ログインし直してもらう。断られたときは何も変えない（通知の購読も外さない）。
 * 消せたら、この端末のブラウザの購読を外す（サーバーの宛先の行はアカウントと一緒に消えている）。
 * セッションのクッキーは Better Auth の返事が消す。この端末に残す「前にログインした」印は、このアプリには無い
 */
export async function deleteAccount(): Promise<'deleted' | 'stale' | 'failed'> {
  const { error } = await authClient.deleteUser().catch(() => ({ error: { code: undefined } }));
  if (error) return error.code === 'SESSION_EXPIRED' ? 'stale' : 'failed';
  await unsubscribeBrowser().catch(() => {});
  return 'deleted';
}
