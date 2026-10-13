import { defineConfig, devices } from '@playwright/test';

/**
 * ブラウザを動かして、最初の登録から試技を足すまでの流れを確かめる（vocafy と同じ形）。
 * 本番と同じ作りで見るため、ビルドしてから起動する。ビルドは1回だけ。
 * ログインは Google を通さず、scripts/dev-session.ts で作ったセッションの Cookie を入れる（e2e/session.ts）
 */
const port = 3312;
const baseURL = `http://localhost:${port}`;

export default defineConfig({
  testDir: './e2e',
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: { baseURL, locale: 'ja-JP', timezoneId: 'Asia/Tokyo', trace: 'retain-on-failure' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    command: `pnpm build && pnpm start -p ${port}`,
    // 手元の開発サーバー（.next）を上書きしないよう、別のフォルダにビルドする（next.config.ts の distDir）
    // サーバーは Vercel と同じ UTC で動かす（手元の日本時間のままだと、時間帯の取り違えが手元で出ない。comic-time と同じ）
    env: { NEXT_DIST_DIR: '.next-e2e', BETTER_AUTH_URL: baseURL, TZ: 'UTC' },
    url: `${baseURL}/sign-in`,
    reuseExistingServer: !process.env.CI,
    timeout: 300_000,
  },
});
