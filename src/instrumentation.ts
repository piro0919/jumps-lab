import * as Sentry from '@sentry/nextjs';

/**
 * サーバーで Sentry を起こす。設定は src/lib/monitoring.ts にある。
 * **`onRequestError` が本命**——ページや Server Action が 500 で落ちたとき、ここに届く
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === 'nodejs' || process.env.NEXT_RUNTIME === 'edge') {
    const { sentryOptions } = await import('@/lib/monitoring');
    Sentry.init(sentryOptions);
  }
}

export const onRequestError = Sentry.captureRequestError;
