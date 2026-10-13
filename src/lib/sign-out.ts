'use client';

import { authClient } from '@/lib/auth-client';

/** 通知の片付けを待つ上限。電波が悪くてもログアウトを待たせない */
const PUSH_CLEANUP_TIMEOUT_MS = 3000;

/**
 * この端末の通知の宛先を外す。先にサーバーの行を消し（ログインしているうちに）、次にブラウザの購読を外す。
 * Service Worker を新しく登録はしない（通知を入れていない端末では何もしない）
 */
async function dropPushSubscription(): Promise<void> {
  if (!('serviceWorker' in navigator)) return;
  const registration = await navigator.serviceWorker.getRegistration('/');
  const subscription = await registration?.pushManager.getSubscription();
  if (!subscription) return;
  await fetch(`/api/push?endpoint=${encodeURIComponent(subscription.endpoint)}`, {
    method: 'DELETE',
  }).catch(() => {});
  await subscription.unsubscribe();
}

/**
 * ログアウト（設定のボタンと、自分のアイコンのメニュー）。共用の端末で、前の選手の大会の通知が
 * 次の人に届かないよう、先にこの端末の通知を外す。外せなくても、時間がかかってもログアウトは止めない
 */
export async function signOut(): Promise<void> {
  await Promise.race([
    dropPushSubscription().catch(() => {}),
    new Promise((resolve) => setTimeout(resolve, PUSH_CLEANUP_TIMEOUT_MS)),
  ]);
  await authClient.signOut();
}
