import { createEnv } from '@t3-oss/env-nextjs';
import { z } from 'zod';

/**
 * サイトが読む環境変数の検査。next.config.ts が読み込むので、欠けていればビルドの頭で止まる。
 * scripts/ の鍵は手元でしか使わないので、ここではなく scripts/lib/env.ts で確かめる
 */
export const env = createEnv({
  server: {
    // 手元は compose.yaml の Postgres、本番は Neon（プールを通す接続文字列）
    DATABASE_URL: z.string().min(1),
    // ログイン（Better Auth）。鍵を持たないビルドや CI も通すため、ここでは任意にしておく。
    // 欠けたままログインの受け口に来たら、そこで名前を挙げて止まる（src/lib/auth.ts）
    BETTER_AUTH_SECRET: z.string().min(32).optional(),
    BETTER_AUTH_URL: z.url().optional(),
    GOOGLE_CLIENT_ID: z.string().min(1).optional(),
    GOOGLE_CLIENT_SECRET: z.string().min(1).optional(),
    // Sentry の送り先。無ければ送らない（src/lib/monitoring.ts）
    SENTRY_DSN: z.url().optional(),
    // 動画の置き場（Cloudflare R2）。手元は jumps-lab-dev にだけ書ける鍵、本番は jumps-lab。
    // 無くてもビルドは通し、使う時点で名前を挙げて止まる（src/lib/r2.ts。onigiri と同じ）
    R2_ENDPOINT: z.url().optional(),
    R2_ACCESS_KEY_ID: z.string().min(1).optional(),
    R2_SECRET_ACCESS_KEY: z.string().min(1).optional(),
    R2_BUCKET: z.string().min(1).optional(),
  },
  client: {},
  runtimeEnv: {
    DATABASE_URL: process.env.DATABASE_URL,
    BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
    BETTER_AUTH_URL: process.env.BETTER_AUTH_URL,
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
    SENTRY_DSN: process.env.SENTRY_DSN,
    R2_ENDPOINT: process.env.R2_ENDPOINT,
    R2_ACCESS_KEY_ID: process.env.R2_ACCESS_KEY_ID,
    R2_SECRET_ACCESS_KEY: process.env.R2_SECRET_ACCESS_KEY,
    R2_BUCKET: process.env.R2_BUCKET,
  },
  emptyStringAsUndefined: true,
});
