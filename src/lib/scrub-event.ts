import type { ErrorEvent } from '@sentry/nextjs';
import { redactSecretPaths } from '@/lib/redact-path';

/*
 * Sentry へ送る前に削る中身（src/lib/monitoring.ts の beforeSend）。鍵を読まないよう別のファイルに置き、
 * test/monitoring.test.ts で確かめる
 */

/**
 * 問い合わせの文字列ごと落とす。ログインの戻り先には Google の認可コードが載る。
 * 道に入った保護者へのリンクの鍵も伏せる（/guardian-consent/[token]）
 */
function scrubUrl(url: string | undefined): string | undefined {
  const path = url?.split('?')[0];
  return path === undefined ? undefined : redactSecretPaths(path);
}

/**
 * 送る前に中身を削る。**本文・Cookie・ヘッダーは送らない**——Server Action の本文には
 * 記録やメモが、ヘッダーには IP（x-forwarded-for）が、Cookie にはセッションが載る
 */
export function scrubEvent(event: ErrorEvent): ErrorEvent {
  delete event.user;
  if (event.request) {
    event.request.url = scrubUrl(event.request.url);
    delete event.request.cookies;
    delete event.request.data;
    delete event.request.headers;
    delete event.request.query_string;
  }
  // Next.js が別に添える道にも、問い合わせの文字列が載る
  const nextjs = event.contexts?.nextjs;
  if (nextjs !== undefined && typeof nextjs.request_path === 'string') {
    nextjs.request_path = scrubUrl(nextjs.request_path);
  }
  // 取引の名前（ページの道）にも鍵が載る
  if (typeof event.transaction === 'string') {
    event.transaction = redactSecretPaths(event.transaction);
  }
  // 落ちる前の足跡は丸ごと送らない。console.error の中身（DB のエラーには保存しかけた行、つまり記録やメモが載る）や、
  // 天気の問い合わせの緯度・経度が入る
  delete event.breadcrumbs;
  return event;
}
