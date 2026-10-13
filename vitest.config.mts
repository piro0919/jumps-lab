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
    environment: 'node',
    env: {
      // 本番（Vercel）と同じ世界標準時で走らせる。「今日」やシーズンの境目を本人の時間帯で数えるので、
      // 日本時間の手元で走らせると UTC でだけ起きる食い違いがすり抜ける（鯉魂の vitest.config.mts と同じ）
      TZ: 'UTC',
    },
    projects: [
      // DB の要らないテスト（pnpm test。push の前にも走る）
      {
        extends: true,
        test: {
          name: 'unit',
          include: ['test/**/*.test.{ts,tsx}'],
          exclude: ['test/db/**'],
          // 部品のテストだけ、ファイルの頭の `// @vitest-environment happy-dom` で DOM を使う（vocafy と同じ）。
          // 外のファイルや埋め込みを取りに行かない
          environmentOptions: {
            happyDOM: {
              settings: {
                disableIframePageLoading: true,
                disableJavaScriptFileLoading: true,
                disableCSSFileLoading: true,
              },
            },
          },
        },
      },
      // DB を読み書きするテスト（pnpm test:db）。テスト用の DB を作り直して使う（test/db/global-setup.ts）。
      // 人ごとの advisory lock や同時の保存を確かめるので、ファイルは1つずつ走らせる
      {
        extends: true,
        test: {
          name: 'db',
          include: ['test/db/**/*.test.ts'],
          globalSetup: ['test/db/global-setup.ts'],
          setupFiles: ['test/db/env.ts'],
          fileParallelism: false,
        },
      },
    ],
  },
});
