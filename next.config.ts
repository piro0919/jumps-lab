import { withSentryConfig } from '@sentry/nextjs/config';
import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';
// 環境変数を確かめる。欠けていればビルドの頭で止まる
import './src/env';

const nextConfig: NextConfig = {
  // e2e のビルドは別のフォルダに作る（playwright.config.ts が NEXT_DIST_DIR を渡す）。同じ .next に作ると、
  // 動いている開発サーバーの作りかけを上書きする（vocafy と同じ）
  distDir: process.env.NEXT_DIST_DIR ?? '.next',
  // スマホから手元の開発サーバーを開くため（http://MacBook-Pro.local:3000 のように Mac の名前で開く）。
  // 開発サーバーは、localhost 以外から開かれると画面を動かす部品を渡さない
  allowedDevOrigins: ['*.local'],
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          // ほかのサイトの枠に入れさせない
          { key: 'Content-Security-Policy', value: "frame-ancestors 'none'" },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
      {
        // 通知の Service Worker（public/sw.js）。ブラウザやCDNに古い版を持たせず、直したら次に開いたときに入れ替わるように
        source: '/sw.js',
        headers: [{ key: 'Cache-Control', value: 'no-cache' }],
      },
    ];
  },
};

// 画面の文言（messages/）を読む。読み方は src/i18n/request.ts
const withNextIntl = createNextIntlPlugin();

// Sentry（src/instrumentation.ts）。鍵が無いビルド（手元・CI）はソースマップを上げずに通る
export default withSentryConfig(withNextIntl(nextConfig), {
  authToken: process.env.SENTRY_AUTH_TOKEN,
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  silent: !process.env.CI,
  // ビルドのたびに SDK の使われ方を Sentry へ送るのを止める。要るのは落ちた知らせだけ
  telemetry: false,
  sourcemaps: { deleteSourcemapsAfterUpload: true },
});
