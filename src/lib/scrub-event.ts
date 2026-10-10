import type { ErrorEvent } from '@sentry/nextjs';

/*
 * Sentry へ送る前に削る中身（src/lib/monitoring.ts の beforeSend）。鍵を読まないよう別のファイルに置き、
 * test/monitoring.test.ts で確かめる
 */

/** 問い合わせの文字列ごと落とす。ログインの戻り先には Google の認可コードが載る */
function scrubUrl(url: string | undefined): string | undefined {
  return url?.split('?')[0];
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
  for (const crumb of event.breadcrumbs ?? []) {
    const value = crumb.data?.url;
    if (typeof value === 'string') crumb.data!.url = scrubUrl(value);
  }
  return event;
}
