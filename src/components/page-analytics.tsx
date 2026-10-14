'use client';

import { Analytics, type BeforeSendEvent } from '@vercel/analytics/next';
import { redactSecretPaths } from '@/lib/redact-path';

/** 送る前にアドレスの秘密を伏せる。保護者へのリンクの鍵を閲覧数の記録に残さない */
export function redactAnalyticsEvent(event: BeforeSendEvent): BeforeSendEvent {
  return { ...event, url: redactSecretPaths(event.url) };
}

/**
 * 閲覧数の集計（Vercel Web Analytics）。Cookie を使わない（プライバシーポリシーの5）。
 * beforeSend は関数なので、サーバーのレイアウトからは渡せず、この部品で包む
 */
export function PageAnalytics() {
  return <Analytics beforeSend={redactAnalyticsEvent} />;
}
