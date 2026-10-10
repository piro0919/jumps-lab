import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';
// 環境変数を確かめる。欠けていればビルドの頭で止まる
import './src/env';

const nextConfig: NextConfig = {
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
    ];
  },
};

// 画面の文言（messages/）を読む。読み方は src/i18n/request.ts
const withNextIntl = createNextIntlPlugin();

export default withNextIntl(nextConfig);
