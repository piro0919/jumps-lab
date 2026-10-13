import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      // server-only はサーバーの外で読み込むと止まる。テストでは中身の無い版に差し替える（vocafy と同じ）
      'server-only': fileURLToPath(new URL('./node_modules/server-only/empty.js', import.meta.url)),
    },
  },
  test: {
    include: ['test/**/*.test.{ts,tsx}'],
    // 部品のテストだけ、ファイルの頭の `// @vitest-environment happy-dom` で DOM を使う（vocafy と同じ）。
    // 外のファイルや埋め込みを取りに行かない
    environment: 'node',
    environmentOptions: {
      happyDOM: {
        settings: {
          disableIframePageLoading: true,
          disableJavaScriptFileLoading: true,
          disableCSSFileLoading: true,
        },
      },
    },
    env: {
      // 本番（Vercel）と同じ世界標準時で走らせる。「今日」やシーズンの境目を本人の時間帯で数えるので、
      // 日本時間の手元で走らせると UTC でだけ起きる食い違いがすり抜ける（鯉魂の vitest.config.mts と同じ）
      TZ: 'UTC',
    },
  },
});
